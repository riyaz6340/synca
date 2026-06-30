/**
 * AsyncStorage-backed navigation state persistence.
 *
 * Persists the React Navigation state tree so the app can restore the user to
 * their last-viewed screen on resume from background. Only meaningful when the
 * user is authenticated — there is no point storing the login-screen position.
 *
 * - {@link loadNavigationState} reads a versioned key from AsyncStorage and
 *   returns the deserialized state, or `undefined` on first launch / corrupt
 *   data so the navigator mounts with its default initial route.
 * - {@link persistNavigationState} debounces writes (~1 s) to avoid hitting
 *   AsyncStorage on every micro-transition (e.g. tab swipes).
 * - {@link clearNavigationState} removes the stored state (called on logout).
 *
 * Validates: Requirements 23.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationState } from '@react-navigation/native';

/** Versioned AsyncStorage key for navigation state. */
export const NAV_STATE_STORAGE_KEY = 'avento.navigation.state.v1';

/** Debounce window (ms) for coalescing navigation state writes. */
export const PERSIST_DEBOUNCE_MS = 1_000;

/**
 * Load a previously persisted navigation state from AsyncStorage.
 *
 * Returns `undefined` when nothing is stored or when the payload is malformed /
 * corrupted, so the navigator mounts with its default initial route. Never
 * throws — a failed load must not block app startup.
 */
export async function loadNavigationState(): Promise<NavigationState | undefined> {
  try {
    const raw = await AsyncStorage.getItem(NAV_STATE_STORAGE_KEY);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw);

    // Basic structural validation: navigation state always has `routes` array.
    if (
      parsed != null &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.routes) &&
      parsed.routes.length > 0
    ) {
      return parsed as NavigationState;
    }

    // Malformed — remove so next launch is clean.
    await AsyncStorage.removeItem(NAV_STATE_STORAGE_KEY);
    return undefined;
  } catch {
    // Corrupt JSON / storage error: ignore and start fresh.
    return undefined;
  }
}

/** Handle to the current debounce timer, if any. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Persist the navigation state to AsyncStorage with debouncing (~1 s).
 *
 * Multiple rapid calls (tab switches, stack pushes) are coalesced into a single
 * write. Best-effort — never throws.
 */
export function persistNavigationState(state: NavigationState): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void writeState(state);
  }, PERSIST_DEBOUNCE_MS);
}

/** Internal: write state to AsyncStorage. Swallows errors. */
async function writeState(state: NavigationState): Promise<void> {
  try {
    await AsyncStorage.setItem(NAV_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Best-effort: a failed write just means the state won't be restored.
  }
}

/**
 * Remove the persisted navigation state (e.g. on logout). Never throws.
 * Also cancels any pending debounced write.
 */
export async function clearNavigationState(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  try {
    await AsyncStorage.removeItem(NAV_STATE_STORAGE_KEY);
  } catch {
    // Ignore — removal failure is non-critical.
  }
}

/**
 * Flush any pending debounced write immediately (test utility).
 * @internal Exposed for deterministic testing of the debounce behavior.
 */
export function _flushPendingWrite(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
