/**
 * `useAttendanceSession` — manages local attendance session persistence via
 * AsyncStorage. Auto-saves after each mark, handles 24-hour expiration,
 * membership change detection, and exit confirmation.
 *
 * Storage key: `attendance_session_{groupId}_{date}`
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 12.4
 */
import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AttendanceMember {
  person_id: string;
  name: string;
  roll_number: number | null;
  photo_url: string | null;
  status: 'Present' | 'Absent' | 'Late' | null;
}

export interface StoredAttendanceSession {
  group_id: string;
  date: string;
  members: AttendanceMember[];
  current_position: number;
  saved_at: string;
  member_ids_hash: string;
}

export interface UseAttendanceSessionOptions {
  groupId: string;
  date: string;
}

export interface UseAttendanceSessionReturn {
  /** Persist the current session state to AsyncStorage. */
  saveSession: (members: AttendanceMember[], currentPosition: number) => Promise<void>;
  /** Load a previously stored session (returns null if none or expired). */
  loadSession: () => Promise<StoredAttendanceSession | null>;
  /** Remove stored session from AsyncStorage. */
  clearSession: () => Promise<void>;
  /** Check if a given session has expired (≥ 24 hours old). */
  isExpired: (session: StoredAttendanceSession) => boolean;
  /** Detect if group membership has changed since session was saved. */
  hasMembershipChanged: (
    session: StoredAttendanceSession,
    currentMembers: Array<{ person_id: string }>,
  ) => boolean;
  /** Show exit confirmation prompt; resolves with user choice. */
  confirmExit: () => Promise<'save' | 'discard'>;
  /** Check for a resumable session and prompt the user. */
  checkForResumableSession: (
    currentMembers: Array<{ person_id: string }>,
  ) => Promise<{ action: 'resume'; session: StoredAttendanceSession } | { action: 'new' } | { action: 'membership_changed'; session: StoredAttendanceSession }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Utility functions (exported for testing) ────────────────────────────────

/**
 * Compute a deterministic hash of member IDs for change detection.
 * Sorts IDs alphabetically and joins with a separator, then produces
 * a simple string hash. This is intentionally lightweight — not crypto-grade.
 */
export function computeMemberIdsHash(members: Array<{ person_id: string }>): string {
  const sorted = members.map((m) => m.person_id).sort();
  const joined = sorted.join('|');
  // Simple djb2-style hash producing a hex string
  let hash = 5381;
  for (let i = 0; i < joined.length; i++) {
    hash = ((hash << 5) + hash + joined.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Build the AsyncStorage key for a given group and date.
 */
export function getStorageKey(groupId: string, date: string): string {
  return `attendance_session_${groupId}_${date}`;
}

/**
 * Check whether a session is expired (≥ 24 hours from saved_at).
 */
export function isSessionExpired(session: StoredAttendanceSession): boolean {
  const savedAt = new Date(session.saved_at).getTime();
  const now = Date.now();
  return now - savedAt >= EXPIRATION_MS;
}

/**
 * Detect membership changes by comparing the stored hash with the current members.
 */
export function hasMembershipChangedFn(
  session: StoredAttendanceSession,
  currentMembers: Array<{ person_id: string }>,
): boolean {
  const currentHash = computeMemberIdsHash(currentMembers);
  return session.member_ids_hash !== currentHash;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAttendanceSession(
  options: UseAttendanceSessionOptions,
): UseAttendanceSessionReturn {
  const { groupId, date } = options;
  const storageKey = getStorageKey(groupId, date);

  // Keep a ref to the latest save so we can debounce if needed
  const savePendingRef = useRef(false);

  const saveSession = useCallback(
    async (members: AttendanceMember[], currentPosition: number): Promise<void> => {
      const session: StoredAttendanceSession = {
        group_id: groupId,
        date,
        members,
        current_position: currentPosition,
        saved_at: new Date().toISOString(),
        member_ids_hash: computeMemberIdsHash(members),
      };
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(session));
      } catch {
        // Silently fail — session persistence is best-effort
      }
    },
    [groupId, date, storageKey],
  );

  const loadSession = useCallback(async (): Promise<StoredAttendanceSession | null> => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return null;
      const session: StoredAttendanceSession = JSON.parse(raw);

      // Auto-discard expired sessions
      if (isSessionExpired(session)) {
        await AsyncStorage.removeItem(storageKey);
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clearSession = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch {
      // Silently fail
    }
  }, [storageKey]);

  const isExpired = useCallback((session: StoredAttendanceSession): boolean => {
    return isSessionExpired(session);
  }, []);

  const hasMembershipChanged = useCallback(
    (session: StoredAttendanceSession, currentMembers: Array<{ person_id: string }>): boolean => {
      return hasMembershipChangedFn(session, currentMembers);
    },
    [],
  );

  const confirmExit = useCallback((): Promise<'save' | 'discard'> => {
    return new Promise((resolve) => {
      Alert.alert(
        'Save Progress?',
        'You have an attendance session in progress. Would you like to save your progress or discard it?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => resolve('discard'),
          },
          {
            text: 'Save',
            style: 'default',
            onPress: () => resolve('save'),
          },
        ],
        { cancelable: false },
      );
    });
  }, []);

  const checkForResumableSession = useCallback(
    async (
      currentMembers: Array<{ person_id: string }>,
    ): Promise<
      | { action: 'resume'; session: StoredAttendanceSession }
      | { action: 'new' }
      | { action: 'membership_changed'; session: StoredAttendanceSession }
    > => {
      const session = await loadSession();

      if (!session) {
        return { action: 'new' };
      }

      // Detect membership changes
      if (hasMembershipChangedFn(session, currentMembers)) {
        return { action: 'membership_changed', session };
      }

      return { action: 'resume', session };
    },
    [loadSession],
  );

  return {
    saveSession,
    loadSession,
    clearSession,
    isExpired,
    hasMembershipChanged,
    confirmExit,
    checkForResumableSession,
  };
}

export default useAttendanceSession;
