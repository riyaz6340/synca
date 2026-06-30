/**
 * Unit tests for the filterByName helper used by SearchableDropdown and the
 * login organization search (Requirements 24.1, 24.2).
 *
 * Note: the universal Property 11 (organization search filtering) property
 * test is implemented separately in task 8.2; these are example-based tests
 * covering the helper's core behavior and edge cases.
 */
import { filterByName } from '../filterByName';

interface Org {
  id: string;
  name: string;
}

const orgs: Org[] = [
  { id: '1', name: 'Greenwood High' },
  { id: '2', name: 'Riverside Academy' },
  { id: '3', name: 'greenfield school' },
  { id: '4', name: 'Sunrise Public' },
];

const byName = (o: Org): string => o.name;

describe('filterByName', () => {
  it('returns all items for an empty search', () => {
    expect(filterByName(orgs, '', byName)).toHaveLength(4);
  });

  it('returns all items for a whitespace-only search', () => {
    expect(filterByName(orgs, '   ', byName)).toHaveLength(4);
  });

  it('matches case-insensitively', () => {
    const result = filterByName(orgs, 'GREEN', byName);
    expect(result.map((o) => o.id)).toEqual(['1', '3']);
  });

  it('matches on substrings anywhere in the name', () => {
    const result = filterByName(orgs, 'side', byName);
    expect(result.map((o) => o.id)).toEqual(['2']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterByName(orgs, 'zzz', byName)).toEqual([]);
  });

  it('preserves the original ordering of items', () => {
    const result = filterByName(orgs, 'e', byName);
    expect(result.map((o) => o.id)).toEqual(['1', '2', '3', '4']);
  });

  it('does not mutate the source array', () => {
    const copy = [...orgs];
    filterByName(orgs, 'green', byName);
    expect(orgs).toEqual(copy);
  });
});
