import type { LeaveSubmitInput } from '../api/types';
import { isValidRange } from './dates';

/**
 * Result of leave-request field validation.
 * `ok` is true only when all fields pass; `errors` maps each offending field to an error message.
 */
export interface LeaveValidationResult {
  ok: boolean;
  errors: Partial<Record<keyof LeaveSubmitInput, string>>;
}

/**
 * Validates a leave-request submission input.
 *
 * Checks:
 * - All required fields (person_id, start_date, end_date, reason) are present and non-empty.
 * - The reason contains at least one non-whitespace character.
 * - The date range is valid per `isValidRange` (both dates well-formed YYYY-MM-DD, end >= start).
 *
 * Returns `{ ok: true, errors: {} }` when valid, or `{ ok: false, errors }` with exactly
 * the offending field keys mapped to a descriptive error message.
 *
 * Requirements: 7.2, 7.3
 */
export function validateLeaveSubmit(input: LeaveSubmitInput): LeaveValidationResult {
  const errors: Partial<Record<keyof LeaveSubmitInput, string>> = {};

  // Check person_id is present and non-empty
  if (!input.person_id || input.person_id.trim().length === 0) {
    errors.person_id = 'Person is required';
  }

  // Check start_date is present and non-empty
  if (!input.start_date || input.start_date.trim().length === 0) {
    errors.start_date = 'Start date is required';
  }

  // Check end_date is present and non-empty
  if (!input.end_date || input.end_date.trim().length === 0) {
    errors.end_date = 'End date is required';
  }

  // Check reason is present and contains non-whitespace
  if (!input.reason || input.reason.trim().length === 0) {
    errors.reason = 'Reason is required';
  }

  // If dates are present, validate the range (format + end >= start)
  if (!errors.start_date && !errors.end_date) {
    if (!isValidRange({ start_date: input.start_date, end_date: input.end_date })) {
      // Determine whether it's a format issue or an ordering issue
      // isValidRange checks both format and ordering, so we report on the range
      errors.start_date = 'Invalid date range';
      errors.end_date = 'Invalid date range';
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}
