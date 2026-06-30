/**
 * Pure, dependency-free date-sorting helpers shared by time-stamped list
 * screens (Announcements by `published_at`, Notifications by `created_at`).
 *
 * Kept generic so any screen can sort its own item shape by supplying a
 * `getDate` accessor. Sorting is stable-by-construction (operates on a copy)
 * and tolerant of invalid/missing dates (treated as epoch 0 so they sort last
 * in a descending order).
 *
 * Validates: Requirements 5.2, 7.2
 */

/** Coerce a date-like value (ISO string, epoch ms, or Date) to epoch millis. */
function toTime(value: string | number | Date | null | undefined): number {
  if (value == null) {
    return 0;
  }
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Return a new array sorted in reverse chronological order (most recent first)
 * by the date derived from each item via `getDate`.
 *
 * The input array is not mutated. Items whose date cannot be parsed are
 * treated as the epoch (oldest) and therefore sort to the end.
 */
export function sortByDateDesc<T>(
  items: readonly T[],
  getDate: (item: T) => string | number | Date | null | undefined,
): T[] {
  return [...items].sort((a, b) => toTime(getDate(b)) - toTime(getDate(a)));
}

export default sortByDateDesc;
