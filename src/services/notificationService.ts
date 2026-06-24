import db from '../config/database';
import { enqueueNotification } from './notificationQueue';
import { sendPushToStakeholder } from './webPushService';

export interface CreateNotificationInput {
  organizationId: string;
  stakeholderId: string;
  type: string;
  title: string;
  body: string;
}

export interface NotificationRecord {
  id: string;
  organization_id: string;
  stakeholder_id: string;
  type: string;
  title: string;
  body: string;
  channel_used: string;
  delivery_status: 'Pending' | 'Sent' | 'Failed';
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Creates a Notification record in the database, sends a web push notification (free),
 * and enqueues a delivery job for other channels (SMS/WhatsApp/Email).
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationRecord> {
  const [notification] = await db('notifications')
    .insert({
      organization_id: input.organizationId,
      stakeholder_id: input.stakeholderId,
      type: input.type,
      title: input.title,
      body: input.body,
      channel_used: 'pending',
      delivery_status: 'Pending',
    })
    .returning('*');

  // Send free web push notification immediately (non-blocking, works without Redis)
  sendPushToStakeholder(input.stakeholderId, {
    title: input.title,
    body: input.body,
    type: input.type,
  })
    .then(async (sent) => {
      if (sent) {
        await db('notifications').where('id', notification.id).update({
          delivery_status: 'Sent',
          channel_used: 'web_push',
          sent_at: new Date(),
          updated_at: new Date(),
        });
      }
    })
    .catch(() => { /* web push failure is non-critical */ });

  // Enqueue for other channels (SMS/WhatsApp/Email) if configured
  await enqueueNotification({
    stakeholderId: input.stakeholderId,
    type: input.type,
    title: input.title,
    body: input.body,
    organizationId: input.organizationId,
  });

  return notification;
}

/**
 * Creates Notification records for multiple stakeholders and enqueues delivery jobs for each.
 */
export async function createNotificationsForStakeholders(
  stakeholderIds: string[],
  organizationId: string,
  type: string,
  title: string,
  body: string
): Promise<NotificationRecord[]> {
  const notifications: NotificationRecord[] = [];

  for (const stakeholderId of stakeholderIds) {
    const notification = await createNotification({
      organizationId,
      stakeholderId,
      type,
      title,
      body,
    });
    notifications.push(notification);
  }

  return notifications;
}
