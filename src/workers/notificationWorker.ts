import { Worker, Job } from 'bullmq';
import { NOTIFICATION_QUEUE_NAME, redisConnectionOptions } from '../config/queue';
import db from '../config/database';
import { deliverViaChannel } from '../services/channelAdapters';
import { resolveChannelPriority, CommunicationChannel } from '../utils/channelPriority';

export interface NotificationJobData {
  stakeholderId: string;
  type: string;
  title: string;
  body: string;
  organizationId: string;
}

/**
 * BullMQ Worker that processes notification delivery jobs from the
 * 'notifications' queue. For each job it:
 * 1. Looks up the stakeholder's communication_channels sorted by priority.
 * 2. Iterates channels in priority order, attempting delivery via the
 *    channel adapter.
 * 3. On first successful delivery: updates the notification record with
 *    delivery_status = 'Sent', channel_used, and sent_at.
 * 4. If all channels fail: updates the notification record with
 *    delivery_status = 'Failed'.
 */
async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { stakeholderId, title, body, organizationId } = job.data;

  // 1. Look up stakeholder to get communication channels
  const stakeholder = await db('stakeholders')
    .where({ id: stakeholderId, organization_id: organizationId })
    .first();

  if (!stakeholder) {
    console.error(
      `[NotificationWorker] Stakeholder ${stakeholderId} not found for org ${organizationId}`
    );
    // Mark notification as failed since we can't find the stakeholder
    await markNotificationFailed(stakeholderId, organizationId);
    return;
  }

  // Parse and sort channels by priority (lowest number = highest priority)
  const channels: CommunicationChannel[] = Array.isArray(stakeholder.communication_channels)
    ? stakeholder.communication_channels
    : [];

  const sortedChannels = resolveChannelPriority(channels);

  if (sortedChannels.length === 0) {
    console.warn(
      `[NotificationWorker] No communication channels configured for stakeholder ${stakeholderId}`
    );
    await markNotificationFailed(stakeholderId, organizationId);
    return;
  }

  // 2. Iterate channels in priority order, attempt delivery
  for (const channel of sortedChannels) {
    try {
      const success = await deliverViaChannel(channel.type, channel.config, title, body);

      if (success) {
        // 3. Delivery succeeded — update notification record
        await db('notifications')
          .where({
            stakeholder_id: stakeholderId,
            organization_id: organizationId,
            delivery_status: 'Pending',
          })
          .orderBy('created_at', 'desc')
          .limit(1)
          .update({
            delivery_status: 'Sent',
            channel_used: channel.type,
            sent_at: new Date(),
            updated_at: new Date(),
          });

        console.log(
          `[NotificationWorker] Notification sent to stakeholder ${stakeholderId} via ${channel.type}`
        );
        return;
      }
    } catch (error) {
      console.error(
        `[NotificationWorker] Delivery failed on channel "${channel.type}" for stakeholder ${stakeholderId}:`,
        error
      );
      // Continue to next channel
    }
  }

  // 4. All channels failed
  await markNotificationFailed(stakeholderId, organizationId);
  console.error(
    `[NotificationWorker] All channels failed for stakeholder ${stakeholderId}`
  );
}

/**
 * Marks the most recent pending notification for a stakeholder as Failed.
 */
async function markNotificationFailed(
  stakeholderId: string,
  organizationId: string
): Promise<void> {
  await db('notifications')
    .where({
      stakeholder_id: stakeholderId,
      organization_id: organizationId,
      delivery_status: 'Pending',
    })
    .orderBy('created_at', 'desc')
    .limit(1)
    .update({
      delivery_status: 'Failed',
      updated_at: new Date(),
    });
}

export const notificationWorker = new Worker<NotificationJobData>(
  NOTIFICATION_QUEUE_NAME,
  processNotificationJob,
  {
    connection: redisConnectionOptions,
    concurrency: 5,
  }
);

notificationWorker.on('completed', (job) => {
  console.log(`[NotificationWorker] Job ${job.id} completed`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`[NotificationWorker] Job ${job?.id} failed:`, err.message);
});
