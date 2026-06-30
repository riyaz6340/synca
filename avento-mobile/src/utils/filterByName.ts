/**
 * Pure, dependency-free filtering helper shared by the SearchableDropdown
 * component, the login screen's organization search, and the Property 11
 * organization-search property test.
 *
 * Validates: Requirements 24.1, 24.2
 */

/**
 * Filter a list of items by a case-insensitive substring match against a
 * name derived from each item via `getName`.
 *
 * - An empty/whitespace-only search returns the full list unchanged.
 * - Matching is case-insensitive substring matching ("includes").
 * - Original ordering of items is preserved.
 */
export function filterByName<T>(
  items: readonly T[],
  search: string,
  getName: (item: T) => string
): T[] {
  const needle = search.trim().toLowerCase();
  if (needle.length === 0) {
    return [...items];
  }
  return items.filter((item) => getName(item).toLowerCase().includes(needle));
}

export default filterByName;
