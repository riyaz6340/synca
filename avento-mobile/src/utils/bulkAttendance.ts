/**
 * Pure helpers for the Admin bulk-attendance marking flow.
 *
 * These functions are intentionally dependency-free and side-effect free so
 * they can be imported directly by {@link BulkMarkingScreen} for rendering /
 * submission AND by the property tests (task 11.3) for verification without a
 * React renderer.
 *
 *  - {@link initialMarkingState} produces the default marking state where every
 *    student is "Present" before any user interaction (Property 6 /
 *    Requirement 10.3).
 *  - {@link buildBulkPayload} converts a marking state into the exact
 *    {@link BulkAttendancePayload} sent to `POST /api/attendance/bulk`: one
 *    record per student, each with a valid {@link PresenceStatus} and the
 *    correct group_id / date (Property 5 / Requirements 10.4, 10.5).
 *
 * Validates: Requirements 10.3, 10.4, 10.5
 */
import type { BulkAttendancePayload, Person, PresenceStatus } from '@/types/models';

/**
 * Map of person id → chosen presence status for an in-progress marking session.
 */
export type MarkingState = Record<string, PresenceStatus>;

/**
 * The presence statuses an Admin can toggle a student through while marking, in
 * the order they cycle on tap.
 */
export const MARKABLE_STATUSES: readonly PresenceStatus[] = [
  'Present',
  'Absent',
  'Late',
  'On_Leave',
];

/** Type guard: is `value` one of the four valid presence statuses? */
export function isPresenceStatus(value: unknown): value is PresenceStatus {
  return (
    value === 'Present' ||
    value === 'Absent' ||
    value === 'Late' ||
    value === 'On_Leave'
  );
}

/**
 * Return today's date as an ISO `YYYY-MM-DD` string in local time. Used as the
 * default marking date (Requirement 10.9 defaults to today).
 */
export function todayIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Build the initial marking state for a group: every supplied person defaults
 * to "Present" (Requirement 10.3 / Property 6).
 *
 * Later duplicate ids in the input simply overwrite earlier ones (still
 * "Present"), so the result has exactly one entry per distinct person id.
 */
export function initialMarkingState(
  persons: readonly Pick<Person, 'id'>[],
): MarkingState {
  const state: MarkingState = {};
  for (const person of persons) {
    state[person.id] = 'Present';
  }
  return state;
}

/**
 * Advance a status to the next one in the {@link MARKABLE_STATUSES} cycle. Used
 * when the Admin taps a student to toggle their status
 * (Present → Absent → Late → On_Leave → Present).
 */
export function nextStatus(current: PresenceStatus): PresenceStatus {
  const index = MARKABLE_STATUSES.indexOf(current);
  return MARKABLE_STATUSES[(index + 1) % MARKABLE_STATUSES.length];
}

/**
 * Convert a marking state into the bulk attendance payload for the API.
 *
 * The resulting payload contains exactly one record per entry in
 * `markingState`, preserving the supplied `group_id` and `date`, with each
 * record carrying a valid {@link PresenceStatus} (Property 5 /
 * Requirements 10.4, 10.5).
 */
export function buildBulkPayload(
  groupId: string,
  date: string,
  markingState: MarkingState,
): BulkAttendancePayload {
  const records = Object.entries(markingState).map(([person_id, presence_status]) => ({
    person_id,
    presence_status,
  }));

  return {
    group_id: groupId,
    date,
    records,
  };
}

export default {
  MARKABLE_STATUSES,
  isPresenceStatus,
  todayIso,
  initialMarkingState,
  nextStatus,
  buildBulkPayload,
};
