/**
 * Returns a display-safe organization name.
 * Falls back to "My Institution" for null, undefined, empty, or whitespace-only values.
 */
export function getDisplayName(name: string | null | undefined): string {
  return name?.trim() || 'My Institution'
}
