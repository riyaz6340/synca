import db from '../config/database';

/**
 * Activity Event Service
 *
 * Provides aggregation queries for computing DAU, WAU, MAU, and YAU metrics
 * from the user_activity_events table. All timestamps are treated as UTC.
 *
 * The user_activity_events table has indexes on:
 * - (timestamp, user_id) for aggregation queries
 * - (organization_id, timestamp) for organization-filtered queries
 *
 * Each function supports an optional organizationId filter. When provided,
 * only events for that organization are counted. When omitted, all events
 * platform-wide are counted.
 *
 * All functions return 0 (not null) when no events exist in the window.
 */

/**
 * DAU — Daily Active Users
 *
 * Returns the count of distinct user_ids with at least one activity event
 * on the specified UTC calendar day (00:00:00 to 23:59:59.999 UTC).
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param organizationId - Optional organization filter
 * @returns Distinct user count for the day
 */
export async function getDailyActiveUsers(
  date: string,
  organizationId?: string
): Promise<number> {
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const query = db('user_activity_events')
    .countDistinct('user_id as count')
    .where('timestamp', '>=', startOfDay)
    .where('timestamp', '<=', endOfDay);

  if (organizationId) {
    query.where('organization_id', organizationId);
  }

  const result = await query.first();
  return Number(result?.count) || 0;
}

/**
 * WAU — Weekly Active Users
 *
 * Returns the count of distinct user_ids with at least one activity event
 * in the 7-day window ending on the given date (inclusive).
 * The window spans from (date - 6 days) 00:00:00 UTC to date 23:59:59.999 UTC.
 *
 * @param date - End date string in YYYY-MM-DD format (inclusive)
 * @param organizationId - Optional organization filter
 * @returns Distinct user count for the 7-day window
 */
export async function getWeeklyActiveUsers(
  date: string,
  organizationId?: string
): Promise<number> {
  const endDate = new Date(`${date}T23:59:59.999Z`);
  const startDate = new Date(`${date}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 6);

  const startOfWindow = startDate.toISOString();
  const endOfWindow = endDate.toISOString();

  const query = db('user_activity_events')
    .countDistinct('user_id as count')
    .where('timestamp', '>=', startOfWindow)
    .where('timestamp', '<=', endOfWindow);

  if (organizationId) {
    query.where('organization_id', organizationId);
  }

  const result = await query.first();
  return Number(result?.count) || 0;
}

/**
 * MAU — Monthly Active Users
 *
 * Returns the count of distinct user_ids with at least one activity event
 * in the specified UTC calendar month.
 *
 * @param year - The year (e.g., 2024)
 * @param month - The month (1-12)
 * @param organizationId - Optional organization filter
 * @returns Distinct user count for the calendar month
 */
export async function getMonthlyActiveUsers(
  year: number,
  month: number,
  organizationId?: string
): Promise<number> {
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  // End of month: first day of next month minus 1 millisecond
  const endOfMonth = new Date(Date.UTC(year, month, 1));
  endOfMonth.setUTCMilliseconds(endOfMonth.getUTCMilliseconds() - 1);

  const startOfWindow = startOfMonth.toISOString();
  const endOfWindow = endOfMonth.toISOString();

  const query = db('user_activity_events')
    .countDistinct('user_id as count')
    .where('timestamp', '>=', startOfWindow)
    .where('timestamp', '<=', endOfWindow);

  if (organizationId) {
    query.where('organization_id', organizationId);
  }

  const result = await query.first();
  return Number(result?.count) || 0;
}

/**
 * YAU — Yearly Active Users
 *
 * Returns the count of distinct user_ids with at least one activity event
 * in the specified UTC calendar year.
 *
 * @param year - The year (e.g., 2024)
 * @param organizationId - Optional organization filter
 * @returns Distinct user count for the calendar year
 */
export async function getYearlyActiveUsers(
  year: number,
  organizationId?: string
): Promise<number> {
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const endOfYear = new Date(Date.UTC(year + 1, 0, 1));
  endOfYear.setUTCMilliseconds(endOfYear.getUTCMilliseconds() - 1);

  const startOfWindow = startOfYear.toISOString();
  const endOfWindow = endOfYear.toISOString();

  const query = db('user_activity_events')
    .countDistinct('user_id as count')
    .where('timestamp', '>=', startOfWindow)
    .where('timestamp', '<=', endOfWindow);

  if (organizationId) {
    query.where('organization_id', organizationId);
  }

  const result = await query.first();
  return Number(result?.count) || 0;
}
