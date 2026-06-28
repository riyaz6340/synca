import { notificationQueue, redisEnabled } from '../config/queue';

export interface NotificationJobData {
  stakeholderId: string;
  type: string;
  title: string;
  body: string;
  organizationId: string;
}

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  // Skip if Redis is not configured (web push still works without it)
  if (!redisEnabled || !notificationQueue) {
    return;
  }

  try {
    await notificationQueue.add('send-notification', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  } catch (error) {
    console.warn('[NotificationQueue] Failed to enqueue:', (error as Error).message);
  }
}
