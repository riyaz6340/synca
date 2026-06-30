/**
 * Pure, dependency-free validation helper for the Parent leave-request form.
 *
 * Extracted as a standalone, side-effect-free function so it can be:
 *  - used by `LeaveFormScreen` to block submission and render field-level
 *    errors before any API call is made, and
 *  - exercised directly by the Property 9 property test (task 9.7).
 *
 * Validation rule (Requirements 6.2, 6.4 / Property 9): a submission is
 * INVALID if `start_date > end_date` OR any required field
 * (`person_id`, `start_date`, `end_date`, `reason`) is empty. `leave_type`
 * is optional and never affects validity.
 *
 * Validates: Requirements 6.2, 6.4
 */

/** The set of fields the validator inspects. */
export type LeaveValidationField =
  | 'person_id'
  | 'start_date'
  | 'end_date'
  | 'reason';

/** Raw form input shape (all optional so partial drafts can be validated). */
export interface LeaveRequestFormInput {
  person_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  reason?: string | null;
  leave_type?: string | null;
}

/** Result of validating a leave-request form input. */
export interface LeaveValidationResult {
  valid: boolean;
  errors: Partial<Record<LeaveValidationField, string>>;
}

/** Human-readable, field-level error messages. */
export const LEAVE_ERROR_MESSAGES: Record<LeaveValidationField, string> = {
  person_id: 'Please select a child.',
  start_date: 'Start date is required.',
  end_date: 'End date is required.',
  reason: 'Reason is required.',
};

/** Error message shown when the date range is inverted (start after end). */
export const DATE_RANGE_ERROR = 'Start date must be on or before end date.';

/** True when a value is null/undefined or only whitespace. */
function isEmpty(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

/**
 * Validate a leave-request form input.
 *
 * Returns `{ valid, errors }` where `errors` carries a message for each
 * offending field. The submission is invalid when any required field is empty
 * OR when both dates are present and `start_date > end_date` (lexicographic
 * comparison is correct for the ISO `YYYY-MM-DD` format the backend uses).
 */
export function validateLeaveRequest(
  input: LeaveRequestFormInput
): LeaveValidationResult {
  const errors: Partial<Record<LeaveValidationField, string>> = {};

  const required: LeaveValidationField[] = [
    'person_id',
    'start_date',
    'end_date',
    'reason',
  ];

  for (const field of required) {
    if (isEmpty(input[field])) {
      errors[field] = LEAVE_ERROR_MESSAGES[field];
    }
  }

  // Only compare the range when both dates are present; an empty date is
  // already reported above and must not also produce a range error.
  const start = input.start_date?.trim();
  const end = input.end_date?.trim();
  if (start && end && start > end) {
    errors.end_date = DATE_RANGE_ERROR;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export default validateLeaveRequest;
