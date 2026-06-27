import type { AttendanceRecord, Announcement, Notification } from '../api/types';

/**
 * Sorts attendance records by date in descending (most recent first) order.
 * Returns a new array — the input is not mutated.
 */
export function sortAttendanceByDateDesc(records: AttendanceRecord[]): AttendanceRecord[] {
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Sorts announcements by published_at timestamp in descending (most recent first) order.
 * Returns a new array — the input is not mutated.
 */
export function sortAnnouncementsByPublishedDesc(announcements: Announcement[]): Announcement[] {
  return [...announcements].sort((a, b) => b.published_at.localeCompare(a.published_at));
}

/**
 * Computes the effective date for a notification: sent_at if present, otherwise created_at.
 */
function effectiveDate(notification: Notification): string {
  return notification.sent_at ?? notification.created_at;
}

/**
 * Sorts notifications by effective date (sent_at ?? created_at) in descending order.
 * Returns a new array — the input is not mutated.
 */
export function sortNotificationsByEffectiveDateDesc(notifications: Notification[]): Notification[] {
  return [...notifications].sort((a, b) =>
    effectiveDate(b).localeCompare(effectiveDate(a))
  );
}
