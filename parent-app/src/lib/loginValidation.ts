/**
 * Login form field validation.
 * Validates that email, password, and organization are present and non-whitespace.
 */

export interface LoginValidationResult {
  ok: boolean;
  missingFields: string[];
}

/**
 * Validates login fields, returning exactly the set of fields that are missing or whitespace-only.
 *
 * @param email - The email address entered by the user
 * @param password - The password entered by the user
 * @param organization - The organization identifier entered by the user
 * @returns An object with `ok` (true if all fields are valid) and `missingFields` (names of invalid fields)
 */
export function validateLoginFields(
  email: string,
  password: string,
  organization: string
): LoginValidationResult {
  const missingFields: string[] = [];

  if (!email || email.trim().length === 0) {
    missingFields.push('email');
  }
  if (!password || password.trim().length === 0) {
    missingFields.push('password');
  }
  if (!organization || organization.trim().length === 0) {
    missingFields.push('organization');
  }

  return {
    ok: missingFields.length === 0,
    missingFields,
  };
}
