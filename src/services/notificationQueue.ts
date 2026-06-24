import { notificationQueue } from '../config/queue';

export interface NotificationJobData {
  stakeholderId: string;
  type: string;
  title: string;
  body: string;
  organizationId: string;
}

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  try {
    await notificationQueue.add('send-notification', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  } catch (error) {
    // Log but don't throw — notification queue failures shouldn't break the main request
    console.warn('[NotificationQueue] Failed to enqueue notification (Redis may be unavailable):', (error as Error).message);
  }
}
