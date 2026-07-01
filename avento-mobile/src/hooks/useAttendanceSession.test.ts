/**
 * Unit tests for `useAttendanceSession` hook utility functions.
 *
 * Tests the pure utility functions (computeMemberIdsHash, getStorageKey,
 * isSessionExpired, hasMembershipChangedFn) and the hook behavior via
 * mocked AsyncStorage.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 12.4
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act } from '@testing-library/react-native';
import {
  computeMemberIdsHash,
  getStorageKey,
  isSessionExpired,
  hasMembershipChangedFn,
  useAttendanceSession,
  type StoredAttendanceSession,
  type AttendanceMember,
} from './useAttendanceSession';

// ─── Pure utility function tests ─────────────────────────────────────────────

describe('computeMemberIdsHash', () => {
  it('produces the same hash for the same set of IDs regardless of order', () => {
    const hash1 = computeMemberIdsHash([
      { person_id: 'a' },
      { person_id: 'b' },
      { person_id: 'c' },
    ]);
    const hash2 = computeMemberIdsHash([
      { person_id: 'c' },
      { person_id: 'a' },
      { person_id: 'b' },
    ]);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different member sets', () => {
    const hash1 = computeMemberIdsHash([{ person_id: 'a' }, { person_id: 'b' }]);
    const hash2 = computeMemberIdsHash([{ person_id: 'a' }, { person_id: 'c' }]);
    expect(hash1).not.toBe(hash2);
  });

  it('handles an empty member list', () => {
    const hash = computeMemberIdsHash([]);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('handles a single member', () => {
    const hash = computeMemberIdsHash([{ person_id: 'only-one' }]);
    expect(typeof hash).toBe('string');
  });
});

describe('getStorageKey', () => {
  it('produces the correct key format', () => {
    expect(getStorageKey('group-123', '2024-03-15')).toBe(
      'attendance_session_group-123_2024-03-15',
    );
  });
});

describe('isSessionExpired', () => {
  it('returns false for a session saved less than 24 hours ago', () => {
    const session: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: [],
      current_position: 0,
      saved_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(), // 23h ago
      member_ids_hash: 'abc',
    };
    expect(isSessionExpired(session)).toBe(false);
  });

  it('returns true for a session saved exactly 24 hours ago', () => {
    const session: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: [],
      current_position: 0,
      saved_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
      member_ids_hash: 'abc',
    };
    expect(isSessionExpired(session)).toBe(true);
  });

  it('returns true for a session saved more than 24 hours ago', () => {
    const session: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: [],
      current_position: 0,
      saved_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
      member_ids_hash: 'abc',
    };
    expect(isSessionExpired(session)).toBe(true);
  });

  it('returns false for a session saved just now', () => {
    const session: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: [],
      current_position: 0,
      saved_at: new Date().toISOString(),
      member_ids_hash: 'abc',
    };
    expect(isSessionExpired(session)).toBe(false);
  });
});

describe('hasMembershipChangedFn', () => {
  it('returns false when member sets match', () => {
    const members = [{ person_id: 'a' }, { person_id: 'b' }];
    const session: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: [],
      current_position: 0,
      saved_at: new Date().toISOString(),
      member_ids_hash: computeMemberIdsHash(members),
    };
    expect(hasMembershipChangedFn(session, members)).toBe(false);
  });

  it('returns true when a member was added', () => {
    const original = [{ person_id: 'a' }, { person_id: 'b' }];
    const current = [{ person_id: 'a' }, { person_id: 'b' }, { person_id: 'c' }];
    const session: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: [],
      current_position: 0,
      saved_at: new Date().toISOString(),
      member_ids_hash: computeMemberIdsHash(original),
    };
    expect(hasMembershipChangedFn(session, current)).toBe(true);
  });

  it('returns true when a member was removed', () => {
    const original = [{ person_id: 'a' }, { person_id: 'b' }, { person_id: 'c' }];
    const current = [{ person_id: 'a' }, { person_id: 'b' }];
    const session: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: [],
      current_position: 0,
      saved_at: new Date().toISOString(),
      member_ids_hash: computeMemberIdsHash(original),
    };
    expect(hasMembershipChangedFn(session, current)).toBe(true);
  });
});

// ─── Hook integration tests ──────────────────────────────────────────────────

describe('useAttendanceSession hook', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const defaultMembers: AttendanceMember[] = [
    { person_id: 'p1', name: 'Alice', roll_number: 1, photo_url: null, status: 'Present' },
    { person_id: 'p2', name: 'Bob', roll_number: 2, photo_url: null, status: null },
  ];

  it('saveSession persists data to AsyncStorage', async () => {
    const { result } = renderHook(() =>
      useAttendanceSession({ groupId: 'g1', date: '2024-03-15' }),
    );

    await act(async () => {
      await result.current.saveSession(defaultMembers, 1);
    });

    const stored = await AsyncStorage.getItem('attendance_session_g1_2024-03-15');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.group_id).toBe('g1');
    expect(parsed.date).toBe('2024-03-15');
    expect(parsed.members).toHaveLength(2);
    expect(parsed.current_position).toBe(1);
    expect(parsed.member_ids_hash).toBe(computeMemberIdsHash(defaultMembers));
  });

  it('loadSession returns the saved session', async () => {
    const { result } = renderHook(() =>
      useAttendanceSession({ groupId: 'g1', date: '2024-03-15' }),
    );

    await act(async () => {
      await result.current.saveSession(defaultMembers, 0);
    });

    let loaded: StoredAttendanceSession | null = null;
    await act(async () => {
      loaded = await result.current.loadSession();
    });

    expect(loaded).not.toBeNull();
    expect(loaded!.group_id).toBe('g1');
    expect(loaded!.members).toHaveLength(2);
    expect(loaded!.members[0].status).toBe('Present');
  });

  it('loadSession returns null when no session exists', async () => {
    const { result } = renderHook(() =>
      useAttendanceSession({ groupId: 'nonexistent', date: '2024-01-01' }),
    );

    let loaded: StoredAttendanceSession | null = null;
    await act(async () => {
      loaded = await result.current.loadSession();
    });

    expect(loaded).toBeNull();
  });

  it('loadSession auto-discards expired sessions', async () => {
    // Manually store an expired session
    const expiredSession: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: defaultMembers,
      current_position: 0,
      saved_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago
      member_ids_hash: computeMemberIdsHash(defaultMembers),
    };
    await AsyncStorage.setItem(
      'attendance_session_g1_2024-03-15',
      JSON.stringify(expiredSession),
    );

    const { result } = renderHook(() =>
      useAttendanceSession({ groupId: 'g1', date: '2024-03-15' }),
    );

    let loaded: StoredAttendanceSession | null = null;
    await act(async () => {
      loaded = await result.current.loadSession();
    });

    expect(loaded).toBeNull();
    // Verify it was also removed from storage
    const raw = await AsyncStorage.getItem('attendance_session_g1_2024-03-15');
    expect(raw).toBeNull();
  });

  it('clearSession removes the stored session', async () => {
    const { result } = renderHook(() =>
      useAttendanceSession({ groupId: 'g1', date: '2024-03-15' }),
    );

    await act(async () => {
      await result.current.saveSession(defaultMembers, 0);
    });

    await act(async () => {
      await result.current.clearSession();
    });

    const raw = await AsyncStorage.getItem('attendance_session_g1_2024-03-15');
    expect(raw).toBeNull();
  });

  it('checkForResumableSession returns "new" when no saved session exists', async () => {
    const { result } = renderHook(() =>
      useAttendanceSession({ groupId: 'g1', date: '2024-03-15' }),
    );

    let outcome: any;
    await act(async () => {
      outcome = await result.current.checkForResumableSession([
        { person_id: 'p1' },
        { person_id: 'p2' },
      ]);
    });

    expect(outcome.action).toBe('new');
  });

  it('checkForResumableSession returns "resume" for a valid saved session', async () => {
    const members = [{ person_id: 'p1' }, { person_id: 'p2' }];
    const session: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: defaultMembers,
      current_position: 1,
      saved_at: new Date().toISOString(),
      member_ids_hash: computeMemberIdsHash(members),
    };
    await AsyncStorage.setItem('attendance_session_g1_2024-03-15', JSON.stringify(session));

    const { result } = renderHook(() =>
      useAttendanceSession({ groupId: 'g1', date: '2024-03-15' }),
    );

    let outcome: any;
    await act(async () => {
      outcome = await result.current.checkForResumableSession(members);
    });

    expect(outcome.action).toBe('resume');
    expect(outcome.session.current_position).toBe(1);
  });

  it('checkForResumableSession returns "membership_changed" when members differ', async () => {
    const originalMembers = [{ person_id: 'p1' }, { person_id: 'p2' }];
    const currentMembers = [{ person_id: 'p1' }, { person_id: 'p3' }]; // p2 replaced by p3

    const session: StoredAttendanceSession = {
      group_id: 'g1',
      date: '2024-03-15',
      members: defaultMembers,
      current_position: 0,
      saved_at: new Date().toISOString(),
      member_ids_hash: computeMemberIdsHash(originalMembers),
    };
    await AsyncStorage.setItem('attendance_session_g1_2024-03-15', JSON.stringify(session));

    const { result } = renderHook(() =>
      useAttendanceSession({ groupId: 'g1', date: '2024-03-15' }),
    );

    let outcome: any;
    await act(async () => {
      outcome = await result.current.checkForResumableSession(currentMembers);
    });

    expect(outcome.action).toBe('membership_changed');
  });
});
