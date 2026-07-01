/**
 * Pure helper that resolves an organization name for display purposes.
 * Returns the trimmed name when it is a non-empty string, otherwise
 * falls back to "My School".
 *
 * Validates: Requirements 4.4
 */
export function getDisplayName(name: string | null | undefined): string {
  return name?.trim() || 'My School';
}

export default getDisplayName;
