/**
 * Tests for the "seen announcements" tracking that powers the Announcements
 * tab unread badge (Requirement 5.4).
 *
 * `countUnseen` is exercised as a pure function; the AsyncStorage-backed
 * get/mark helpers are exercised against the official in-memory AsyncStorage
 * mock wired up in the global test setup.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Announcement } from '../types/models';
import {
  LAST_SEEN_KEY,
  countUnseen,
  getLastSeenAt,
  markAllSeen,
  markSeen,
} from './announcementsSeen';

function ann(id: string, publishedAt: string): Announcement {
  return { id, title: `T-${id}`, body: `B-${id}`, published_at: publishedAt };
}

const LIST: Announcement[] = [
  ann('a', '2024-01-01T00:00:00Z'),
  ann('b', '2024-03-01T00:00:00Z'),
  ann('c', '2024-02-01T00:00:00Z'),
];

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('countUnseen', () => {
  it('treats every announcement as new when nothing has been seen', () => {
    expect(countUnseen(LIST, null)).toBe(3);
  });

  it('counts only announcements published after the last-seen timestamp', () => {
    // Seen up to Feb 1 → only the Mar 1 announcement is new.
    expect(countUnseen(LIST, '2024-02-01T00:00:00Z')).toBe(1);
  });

  it('returns zero when the last-seen timestamp is at/after the newest', () => {
    expect(countUnseen(LIST, '2024-03-01T00:00:00Z')).toBe(0);
    expect(countUnseen(LIST, '2024-12-31T00:00:00Z')).toBe(0);
  });

  it('returns zero for an empty list', () => {
    expect(countUnseen([], null)).toBe(0);
  });

  it('does not count announcements with an unparseable publish date', () => {
    const list = [ann('x', 'not-a-date'), ann('y', '2024-05-01T00:00:00Z')];
    expect(countUnseen(list, '2024-01-01T00:00:00Z')).toBe(1);
  });
});

describe('getLastSeenAt / markSeen / markAllSeen', () => {
  it('returns null when nothing has been stored', async () => {
    expect(await getLastSeenAt()).toBeNull();
  });

  it('round-trips a stored timestamp', async () => {
    await markSeen('2024-04-01T00:00:00Z');
    expect(await getLastSeenAt()).toBe('2024-04-01T00:00:00Z');
    expect(await AsyncStorage.getItem(LAST_SEEN_KEY)).toBe(
      '2024-04-01T00:00:00Z',
    );
  });

  it('markSeen ignores a null timestamp', async () => {
    await markSeen(null);
    expect(await getLastSeenAt()).toBeNull();
  });

  it('markAllSeen records the most-recent publish date', async () => {
    await markAllSeen(LIST);
    expect(await getLastSeenAt()).toBe('2024-03-01T00:00:00Z');

    // After marking, nothing is new.
    expect(countUnseen(LIST, await getLastSeenAt())).toBe(0);
  });

  it('markAllSeen is a no-op for an empty list', async () => {
    await markAllSeen([]);
    expect(await getLastSeenAt()).toBeNull();
  });
});
