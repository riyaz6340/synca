/**
 * Unit tests for the generic `sortByDateDesc` helper (task 9.8 / 9.4).
 *
 * Verifies reverse-chronological ordering, input immutability, and tolerance
 * of invalid/missing dates.
 *
 * Validates: Requirements 5.2, 7.2
 */
import { sortByDateDesc } from '../sortByDate';

interface Item {
  id: string;
  at: string;
}

describe('sortByDateDesc', () => {
  it('orders items most-recent-first by the derived date', () => {
    const items: Item[] = [
      { id: 'b', at: '2024-01-02T00:00:00Z' },
      { id: 'a', at: '2024-01-01T00:00:00Z' },
      { id: 'c', at: '2024-01-03T00:00:00Z' },
    ];

    const sorted = sortByDateDesc(items, (i) => i.at);

    expect(sorted.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the input array', () => {
    const items: Item[] = [
      { id: 'a', at: '2024-01-01T00:00:00Z' },
      { id: 'b', at: '2024-01-02T00:00:00Z' },
    ];
    const snapshot = [...items];

    sortByDateDesc(items, (i) => i.at);

    expect(items).toEqual(snapshot);
  });

  it('treats invalid/missing dates as oldest (sorted last)', () => {
    const items: Item[] = [
      { id: 'valid', at: '2024-05-01T00:00:00Z' },
      { id: 'invalid', at: 'not-a-date' },
    ];

    const sorted = sortByDateDesc(items, (i) => i.at);

    expect(sorted.map((i) => i.id)).toEqual(['valid', 'invalid']);
  });

  it('accepts Date and epoch-millis accessors', () => {
    const items = [
      { id: 'older', when: new Date('2024-01-01T00:00:00Z') },
      { id: 'newer', when: new Date('2024-02-01T00:00:00Z') },
    ];

    const sorted = sortByDateDesc(items, (i) => i.when);

    expect(sorted.map((i) => i.id)).toEqual(['newer', 'older']);
  });
});
