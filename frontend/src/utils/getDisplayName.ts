/**
 * Returns a display-safe organization name.
 * Falls back to "My School" for null, undefined, empty, or whitespace-only values.
 */
export function getDisplayName(name: string | null | undefined): string {
  return name?.trim() || 'My School'
}
