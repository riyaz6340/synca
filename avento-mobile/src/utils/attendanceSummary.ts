/**
 * Pure helpers for summarizing a parent's child attendance history.
 *
 * `computeAttendanceSummary` counts how many records fall into each
 * {@link PresenceStatus}. It is intentionally dependency-free and side-effect
 * free so it can be imported directly by the Attendance History screen for
 * rendering and by the property test (Property 12) for verification.
 *
 * Validates: Requirement 4.4
 */
import type { AttendanceRecord, PresenceStatus } from '@/types/models';

/** Per-status counts for a list of attendance records. */
export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  on_leave: number;
}

/** A summary with all counts at zero (used as the reduction seed). */
export function emptyAttendanceSummary(): AttendanceSummary {
  return { present: 0, absent: 0, late: 0, on_leave: 0 };
}

/** Map a PresenceStatus to the summary key that tracks its count. */
const STATUS_TO_KEY: Record<PresenceStatus, keyof AttendanceSummary> = {
  Present: 'present',
  Absent: 'absent',
  Late: 'late',
  On_Leave: 'on_leave',
};

/**
 * Count the number of records for each presence status.
 *
 * For any list of {@link AttendanceRecord}s, the returned counts equal the
 * actual number of records carrying each respective {@link PresenceStatus}.
 * Records whose `presence_status` is not a recognized value are ignored.
 */
export function computeAttendanceSummary(
  records: readonly AttendanceRecord[]
): AttendanceSummary {
  const summary = emptyAttendanceSummary();
  for (const record of records) {
    const key = STATUS_TO_KEY[record.presence_status];
    if (key !== undefined) {
      summary[key] += 1;
    }
  }
  return summary;
}

export default computeAttendanceSummary;
