/**
 * Pure, dependency-free validation helper for the Change Password form.
 *
 * Extracted as a standalone, side-effect-free function so it can be:
 *  - used by `ChangePasswordScreen` to gate submission and render field-level
 *    errors before any API call is made, and
 *  - exercised directly by the Property 14 property test (task 9.10).
 *
 * Validation rule (Requirement 8.2 / Property 14): a password change is
 * submittable IF AND ONLY IF the new password is at least 6 characters long
 * AND the new password equals the confirm password.
 *
 * Validates: Requirements 8.2
 */

/** Minimum acceptable length for a new password. */
export const MIN_PASSWORD_LENGTH = 6;

/** The set of fields the validator can report errors against. */
export type PasswordValidationField = 'newPassword' | 'confirmPassword';

/** Raw form input shape for a password change. */
export interface PasswordChangeInput {
  newPassword: string;
  confirmPassword: string;
}

/** Result of validating a password-change form input. */
export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
  /** The specific field the error relates to, when applicable. */
  field?: PasswordValidationField;
}

/** Human-readable error message: new password is too short. */
export const TOO_SHORT_ERROR = `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;

/** Human-readable error message: confirmation does not match. */
export const MISMATCH_ERROR = 'New password and confirmation do not match.';

/**
 * Validate a password-change form input.
 *
 * The form is submittable (`valid: true`) if and only if:
 *  - `newPassword.length >= MIN_PASSWORD_LENGTH`, AND
 *  - `newPassword === confirmPassword`.
 *
 * The length check is evaluated first so a too-short password surfaces the
 * length error even when the confirmation also differs. Passwords are compared
 * verbatim — leading/trailing whitespace is significant and never trimmed.
 */
export function validatePasswordChange(
  input: PasswordChangeInput,
): PasswordValidationResult {
  const { newPassword, confirmPassword } = input;

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: TOO_SHORT_ERROR, field: 'newPassword' };
  }

  if (newPassword !== confirmPassword) {
    return { valid: false, error: MISMATCH_ERROR, field: 'confirmPassword' };
  }

  return { valid: true };
}

export default validatePasswordChange;
