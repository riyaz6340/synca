import { Queue, Worker } from 'bullmq';
import { redisConnectionOptions } from '../config/queue';
import { processScheduledAnnouncements } from '../services/scheduledAnnouncementService';

const SCHEDULED_ANNOUNCEMENTS_QUEUE = 'scheduled-announcements';

/**
 * BullMQ queue for scheduled announcement processing.
 * Uses a repeatable job that runs every 60 seconds to check for
 * announcements whose scheduled_at time has passed but are not yet published.
 */
const scheduledAnnouncementQueue = new Queue(SCHEDULED_ANNOUNCEMENTS_QUEUE, {
  connection: redisConnectionOptions,
});

/**
 * Worker that processes the repeatable scheduled announcement job.
 * Each execution calls processScheduledAnnouncements() and logs the result.
 */
const scheduledAnnouncementWorker = new Worker(
  SCHEDULED_ANNOUNCEMENTS_QUEUE,
  async () => {
    const count = await processScheduledAnnouncements();
    if (count > 0) {
      console.log(`[ScheduledAnnouncementWorker] Published ${count} scheduled announcement(s)`);
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: 1,
  }
);

scheduledAnnouncementWorker.on('completed', (job) => {
  console.log(`[ScheduledAnnouncementWorker] Job ${job.id} completed`);
});

scheduledAnnouncementWorker.on('failed', (job, err) => {
  console.error(`[ScheduledAnnouncementWorker] Job ${job?.id} failed:`, err.message);
});

/**
 * Registers the repeatable job that runs every 60 seconds.
 * BullMQ ensures only one instance of this repeatable job is active.
 */
async function registerRepeatableJob(): Promise<void> {
  await scheduledAnnouncementQueue.upsertJobScheduler(
    'process-scheduled-announcements',
    { every: 60000 },
    {
      name: 'process-scheduled-announcements',
    }
  );
  console.log(
    '[ScheduledAnnouncementWorker] Registered repeatable job: every 60 seconds'
  );
}

registerRepeatableJob().catch((err) => {
  console.error('[ScheduledAnnouncementWorker] Failed to register repeatable job:', err);
});

export { scheduledAnnouncementQueue, scheduledAnnouncementWorker };
