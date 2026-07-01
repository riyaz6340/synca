import db from '../config/database';

/**
 * Activity Events Data Retention Job
 *
 * Deletes user_activity_events older than 13 months.
 * Runs once per day at approximately 2:00 AM UTC.
 * Uses batch deletion (1000 rows at a time) to avoid long-running locks.
 *
 * Requirements: 13.4
 */

const BATCH_SIZE = 1000;
const RETENTION_MONTHS = 13;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const TARGET_HOUR_UTC = 2; // Run at 2:00 AM UTC

let lastRunDate: string | null = null;

/**
 * Deletes activity events older than 13 months in batches.
 * Returns the total number of deleted records.
 */
export async function deleteOldActivityEvents(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - RETENTION_MONTHS);

  let totalDeleted = 0;
  let batchDeleted = 0;

  do {
    // Delete in batches using a subquery to limit rows
    const subquery = db('user_activity_events')
      .where('timestamp', '<', cutoffDate.toISOString())
      .select('id')
      .limit(BATCH_SIZE);

    batchDeleted = await db('user_activity_events')
      .whereIn('id', subquery)
      .del();

    totalDeleted += batchDeleted;
  } while (batchDeleted === BATCH_SIZE);

  return totalDeleted;
}

/**
 * Executes the retention job with error handling.
 * Logs results and catches all errors to prevent crashing the server.
 */
async function runRetentionJob(): Promise<void> {
  try {
    console.log('[ActivityRetention] Starting data retention job...');
    const startTime = Date.now();

    const deletedCount = await deleteOldActivityEvents();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `[ActivityRetention] Completed: deleted ${deletedCount} events older than ${RETENTION_MONTHS} months (${duration}s)`
    );
  } catch (error) {
    console.error(
      '[ActivityRetention] Job failed:',
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Checks if it's time to run the daily retention job.
 * Runs at TARGET_HOUR_UTC (2 AM) and only once per calendar day.
 */
function checkAndRun(): void {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const todayStr = now.toISOString().split('T')[0];

  if (currentHour === TARGET_HOUR_UTC && lastRunDate !== todayStr) {
    lastRunDate = todayStr;
    runRetentionJob();
  }
}

/**
 * Starts the activity retention scheduled job.
 * Checks every hour if it's time to run (2:00 AM UTC daily).
 * Call this once when the server starts.
 */
export function startActivityRetentionJob(): void {
  console.log('[ActivityRetention] Scheduled job initialized (runs daily at 2:00 AM UTC)');

  // Check immediately on startup in case we're at the target hour
  checkAndRun();

  // Then check every hour
  setInterval(checkAndRun, CHECK_INTERVAL_MS);
}
