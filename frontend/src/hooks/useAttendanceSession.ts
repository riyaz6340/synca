import { useState, useCallback, useEffect } from 'react'

/**
 * Stored attendance session interface for localStorage persistence.
 * Represents the full state of a sequential attendance session.
 */
export interface StoredAttendanceSession {
  group_id: string
  date: string // YYYY-MM-DD
  members: Array<{
    person_id: string
    name: string
    roll_number: number | null
    photo_url: string | null
    status: 'Present' | 'Absent' | 'Late' | null
  }>
  current_position: number // 0-indexed
  saved_at: string // ISO timestamp
  member_ids_hash: string // sorted member person_ids joined by comma
}

/** 24 hours in milliseconds */
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000

/**
 * Generates the localStorage key for a given group and date.
 */
export function getStorageKey(groupId: string, date: string): string {
  return `attendance_session_${groupId}_${date}`
}

/**
 * Computes a member_ids_hash by sorting person_ids and joining with commas.
 * Used to detect membership changes between sessions.
 */
export function computeMemberIdsHash(memberIds: string[]): string {
  return [...memberIds].sort().join(',')
}

/**
 * Checks whether a session has expired (older than 24 hours).
 */
export function isSessionExpired(savedAt: string): boolean {
  const savedTime = new Date(savedAt).getTime()
  const now = Date.now()
  return now - savedTime >= SESSION_EXPIRY_MS
}

/**
 * Detects whether the group membership has changed since the session was saved.
 * Compares the stored hash with a freshly computed hash from current member IDs.
 */
export function hasSessionMembershipChanged(
  storedHash: string,
  currentMemberIds: string[]
): boolean {
  const currentHash = computeMemberIdsHash(currentMemberIds)
  return storedHash !== currentHash
}

export interface UseAttendanceSessionOptions {
  groupId: string
  date: string
  currentMemberIds: string[]
}

export interface UseAttendanceSessionReturn {
  /** Save (or auto-save) the current session state to localStorage */
  saveSession: (session: Omit<StoredAttendanceSession, 'saved_at' | 'member_ids_hash' | 'group_id' | 'date'>) => void
  /** Load a session from localStorage (returns null if not found or expired) */
  loadSession: () => StoredAttendanceSession | null
  /** Clear the stored session from localStorage */
  clearSession: () => void
  /** Whether a valid (non-expired) session exists */
  hasExistingSession: boolean
  /** Whether the stored session has different membership than current */
  membershipChanged: boolean
  /** The stored session data (if available and not expired) */
  storedSession: StoredAttendanceSession | null
}

/**
 * Custom hook for managing attendance session persistence in the Admin Panel.
 *
 * Features:
 * - Auto-save: call saveSession after each status mark
 * - Storage key: `attendance_session_{groupId}_{date}`
 * - 24-hour expiration: sessions older than 24h are discarded
 * - Membership change detection via member_ids_hash comparison
 * - Provides functions: saveSession, loadSession, clearSession
 */
export function useAttendanceSession({
  groupId,
  date,
  currentMemberIds,
}: UseAttendanceSessionOptions): UseAttendanceSessionReturn {
  const [storedSession, setStoredSession] = useState<StoredAttendanceSession | null>(null)
  const [hasExistingSession, setHasExistingSession] = useState(false)
  const [membershipChanged, setMembershipChanged] = useState(false)

  const storageKey = getStorageKey(groupId, date)

  /**
   * Load session from localStorage. Returns null if not found or expired.
   */
  const loadSession = useCallback((): StoredAttendanceSession | null => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null

      const session: StoredAttendanceSession = JSON.parse(raw)

      // Check expiration
      if (isSessionExpired(session.saved_at)) {
        // Discard expired sessions
        localStorage.removeItem(storageKey)
        return null
      }

      return session
    } catch {
      // Invalid data in storage, clear it
      localStorage.removeItem(storageKey)
      return null
    }
  }, [storageKey])

  /**
   * Save session to localStorage (auto-save after each mark).
   */
  const saveSession = useCallback(
    (sessionData: Omit<StoredAttendanceSession, 'saved_at' | 'member_ids_hash' | 'group_id' | 'date'>) => {
      const session: StoredAttendanceSession = {
        group_id: groupId,
        date,
        members: sessionData.members,
        current_position: sessionData.current_position,
        saved_at: new Date().toISOString(),
        member_ids_hash: computeMemberIdsHash(currentMemberIds),
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(session))
        setStoredSession(session)
        setHasExistingSession(true)
      } catch {
        // localStorage might be full or unavailable — fail silently
        console.warn('Failed to save attendance session to localStorage')
      }
    },
    [groupId, date, currentMemberIds, storageKey]
  )

  /**
   * Clear the stored session from localStorage.
   */
  const clearSession = useCallback(() => {
    localStorage.removeItem(storageKey)
    setStoredSession(null)
    setHasExistingSession(false)
    setMembershipChanged(false)
  }, [storageKey])

  /**
   * On mount: check if a session exists, is < 24h old, and detect membership changes.
   */
  useEffect(() => {
    const session = loadSession()

    if (session) {
      setStoredSession(session)
      setHasExistingSession(true)

      // Detect membership changes
      if (currentMemberIds.length > 0) {
        const changed = hasSessionMembershipChanged(session.member_ids_hash, currentMemberIds)
        setMembershipChanged(changed)
      }
    } else {
      setStoredSession(null)
      setHasExistingSession(false)
      setMembershipChanged(false)
    }
  }, [loadSession, currentMemberIds])

  return {
    saveSession,
    loadSession,
    clearSession,
    hasExistingSession,
    membershipChanged,
    storedSession,
  }
}

export default useAttendanceSession
