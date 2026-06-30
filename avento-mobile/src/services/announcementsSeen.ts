/**
 * "Seen announcements" tracking.
 *
 * Backs the unread badge on the parent Announcements tab (Requirement 5.4).
 * We persist a single "last seen" timestamp in AsyncStorage (non-sensitive
 * cache data, per Requirement 20.2) representing the publication time of the
 * most-recent announcement the parent has already viewed. The number of
 * "new" announcements is then the count of announcements published strictly
 * after that timestamp.
 *
 * The counting logic ({@link countUnseen}) is a pure function so it can be
 * unit-tested without touching storage.
 *
 * Validates: Requirement 5.4
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Announcement } from '../types/models';

/** AsyncStorage key holding the ISO timestamp of the last-seen announcement. */
export const LAST_SEEN_KEY = 'avento.announcements.lastSeenAt';

/** Convert an ISO/date string into a millisecond timestamp (NaN if invalid). */
function toTime(value: string | null | undefined): number {
  if (value == null) return NaN;
  return new Date(value).getTime();
}

/**
 * Count how many announcements are "new" relative to a last-seen timestamp.
 *
 * - When `lastSeenAt` is null/empty (nothing seen yet), every announcement is
 *   considered new.
 * - Otherwise an announcement is new when its `published_at` is strictly later
 *   than `lastSeenAt`.
 * - Announcements with an unparseable `published_at` are not counted as new.
 *
 * This is a pure function — no I/O — and is safe to call on every render.
 */
export function countUnseen(
  announcements: readonly Announcement[],
  lastSeenAt: string | null,
): number {
  const seenTime = toTime(lastSeenAt);
  if (Number.isNaN(seenTime)) {
    // Nothing recorded as seen yet → all announcements are new.
    return announcements.length;
  }
  return announcements.reduce((count, a) => {
    const published = toTime(a.published_at);
    return !Number.isNaN(published) && published > seenTime ? count + 1 : count;
  }, 0);
}

/** Read the stored last-seen timestamp, or null when nothing is stored. */
export async function getLastSeenAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SEEN_KEY);
  } catch {
    // Treat read failures as "nothing seen" rather than crashing the badge.
    return null;
  }
}

/**
 * Mark announcements up to (and including) `timestamp` as seen. Pass the
 * `published_at` of the most-recent announcement after the list is viewed.
 * A null/undefined timestamp is a no-op.
 */
export async function markSeen(timestamp: string | null | undefined): Promise<void> {
  if (timestamp == null) return;
  try {
    await AsyncStorage.setItem(LAST_SEEN_KEY, timestamp);
  } catch {
    // Best-effort: failing to persist just means the badge stays visible.
  }
}

/**
 * Mark every announcement in the list as seen by recording the most-recent
 * `published_at`. A no-op for an empty list.
 */
export async function markAllSeen(
  announcements: readonly Announcement[],
): Promise<void> {
  if (announcements.length === 0) return;
  let latest = announcements[0].published_at;
  let latestTime = toTime(latest);
  for (const a of announcements) {
    const t = toTime(a.published_at);
    if (!Number.isNaN(t) && (Number.isNaN(latestTime) || t > latestTime)) {
      latest = a.published_at;
      latestTime = t;
    }
  }
  await markSeen(latest);
}

export const announcementsSeen = {
  LAST_SEEN_KEY,
  countUnseen,
  getLastSeenAt,
  markSeen,
  markAllSeen,
};

export default announcementsSeen;
