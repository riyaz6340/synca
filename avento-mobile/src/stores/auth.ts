/**
 * Authentication store (Zustand) and session management.
 *
 * This is the single source of truth for the authenticated session in memory.
 * It coordinates the three persistence/service layers built earlier:
 *  - {@link authApi}        — login / logout / refresh network calls.
 *  - {@link secureStorage}  — JWT + serialized session in the Android Keystore.
 *  - {@link biometric}      — enable/disable the biometric-login preference.
 *
 * Responsibilities:
 *  - **login**: authenticate, persist the session in Secure Storage, populate
 *    in-memory state, and arm the silent-refresh timer.
 *  - **logout**: best-effort backend logout, then clear BOTH Secure Storage and
 *    AsyncStorage and reset state (Requirement 1.7, 20.3 — Property 7).
 *  - **refreshToken**: exchange the near-expiry token for a fresh one and
 *    re-arm the timer (Requirement 1.5).
 *  - **restoreSession**: on launch, read the stored session; if the token is at
 *    or past the refresh threshold, attempt a silent refresh, and on failure
 *    clear credentials and remain logged out (Requirement 1.4, 1.6).
 *  - **enableBiometric / disableBiometric**: mirror the persisted preference
 *    into state (Requirement 1.8).
 *
 * Token-refresh timing is factored into the **pure, exported** predicate
 * {@link shouldRefreshToken} (Property 8) plus {@link decodeJwtExpiry}, so the
 * "should we refresh?" decision is unit/property testable without timers or a
 * real clock.
 *
 * On import this module wires the shared {@link apiClient} via
 * {@link configureApiClient}: it supplies the bearer token, the active
 * `organization_id`, and the 401 → forced-logout handler (Requirement 1.6).
 *
 * Validates: Requirements 1.2, 1.4, 1.5, 1.6, 1.7, 1.8, 20.3
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { authApi } from '@/api/auth';
import { configureApiClient } from '@/api/client';
import { organizationApi } from '@/api/organization';
import { biometric } from '@/services/biometric';
import { secureStorage } from '@/services/secureStorage';
import type { AuthState } from '@/types/auth';

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit/property testing).
// ---------------------------------------------------------------------------

/**
 * The silent-refresh window: a token is refreshed once its remaining
 * time-to-expiry falls to 5 minutes or less (Requirement 1.5).
 */
export const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/** Lookup table for decoding standard / URL-safe base64 without `atob`. */
const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decode a base64url (or standard base64) string to its raw byte string.
 *
 * Implemented manually so it behaves identically under Hermes (the app) and
 * Node (Jest) without depending on `atob`/`Buffer` being present. Unknown
 * characters are skipped; padding is tolerated.
 */
function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const char of normalized) {
    if (char === '=') {
      break;
    }
    const index = BASE64_CHARS.indexOf(char);
    if (index === -1) {
      continue;
    }
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

/**
 * Decode the `exp` claim of a JWT and return it as a Unix timestamp in
 * **milliseconds**, or `null` when the token is malformed or carries no numeric
 * `exp`. Never throws — a token we cannot read is treated as "no expiry known".
 *
 * JWT `exp` is expressed in seconds since the epoch, so it is scaled to ms to
 * match `Date.now()`.
 */
export function decodeJwtExpiry(token: string): number | null {
  try {
    const segments = token.split('.');
    if (segments.length < 2) {
      return null;
    }

    // Convert the raw byte string to a proper UTF-8 string before parsing so
    // payloads containing multibyte characters (e.g. names) decode correctly.
    const raw = decodeBase64Url(segments[1]);
    const json = decodeURIComponent(
      raw
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );

    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/**
 * Property 8 — token refresh timing.
 *
 * Returns `true` if and only if the remaining time-to-expiry is **less than or
 * equal to** the 5-minute refresh window. A token that is already expired
 * (negative remaining time) is also due for refresh, so it returns `true`.
 *
 * Pure: depends only on its arguments, both Unix timestamps in milliseconds.
 *
 * Validates: Requirements 1.5
 */
export function shouldRefreshToken(expiryMs: number, nowMs: number): boolean {
  return expiryMs - nowMs <= REFRESH_THRESHOLD_MS;
}

// ---------------------------------------------------------------------------
// Silent-refresh timer (module-level so it survives across store reads).
// ---------------------------------------------------------------------------

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Cancel any pending silent-refresh timer. Safe to call when none is armed. */
export function cancelTokenRefresh(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Arm (or re-arm) the silent-refresh timer for the given token.
 *
 * - If the token cannot be decoded, no timer is scheduled.
 * - If the token is already within the refresh window, a refresh is triggered
 *   on the next tick.
 * - Otherwise a timer fires exactly when the token enters the 5-minute window.
 */
function scheduleTokenRefresh(token: string): void {
  cancelTokenRefresh();

  const expiryMs = decodeJwtExpiry(token);
  if (expiryMs === null) {
    return;
  }

  const now = Date.now();
  const delay = shouldRefreshToken(expiryMs, now)
    ? 0
    : expiryMs - now - REFRESH_THRESHOLD_MS;

  refreshTimer = setTimeout(() => {
    void runScheduledRefresh();
  }, delay);
}

/**
 * Timer-driven refresh wrapper. On failure it enforces Requirement 1.6: clear
 * credentials and force a logged-out state (the UI then redirects to login).
 */
async function runScheduledRefresh(): Promise<void> {
  try {
    await useAuthStore.getState().refreshToken();
  } catch {
    await clearLocalSession();
  }
}

// ---------------------------------------------------------------------------
// Local session teardown (no network) — shared by logout and forced-logout.
// ---------------------------------------------------------------------------

/** The logged-out shape of the store. */
const LOGGED_OUT = {
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  biometricEnabled: false,
  organizationName: null,
  logoUrl: null,
  primaryColor: null,
} as const;

/**
 * Clear all on-device session data and reset in-memory state, without calling
 * the backend. Used by the 401 handler and the scheduled-refresh failure path
 * to avoid recursing back into a network call that would itself 401.
 *
 * Clears BOTH Secure Storage (tokens/session) and AsyncStorage (cached data),
 * satisfying Property 7.
 */
async function clearLocalSession(): Promise<void> {
  cancelTokenRefresh();
  try {
    await secureStorage.clearAll();
  } catch {
    // A failed clear must not block logout; state is still reset below.
  }
  try {
    await AsyncStorage.clear();
  } catch {
    // Same rationale: cached-data clear is best-effort.
  }
  useAuthStore.setState({ ...LOGGED_OUT });
}

/**
 * Fetch the organization name from the API and update both the Zustand store
 * and SecureStorage. Fires asynchronously after session restore when the
 * persisted session has no cached organization name (Requirement 6.5).
 *
 * Errors are swallowed: the UI will fall back to "My School" until the next
 * successful fetch.
 */
async function fetchAndCacheOrganizationName(
  session: { token: string; user: any; biometricEnabled: boolean; organizationName?: string },
  currentToken: string,
): Promise<void> {
  try {
    const name = await organizationApi.getOrganizationName();
    if (name) {
      useAuthStore.setState({ organizationName: name });
      await secureStorage.saveSession({
        ...session,
        token: currentToken,
        organizationName: name,
      });
    }
  } catch {
    // Best-effort: UI falls back to "My School" via getDisplayName.
  }
}

// ---------------------------------------------------------------------------
// Store definition.
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  biometricEnabled: false,
  organizationName: null,
  logoUrl: null,
  primaryColor: null,

  login: async (email, password, orgName, orgId) => {
    set({ isLoading: true });
    try {
      const { token, user } = await authApi.login({
        email,
        password,
        organization_name: orgName,
        organization_id: orgId,
      });

      // Extract organization_name from the login response user object
      // (Requirement 6.1 — store on login).
      const organizationName = user.organization_name ?? null;

      // Extract branding fields from the login response user object
      // (Requirement 7.1, 7.5 — store on login).
      const logoUrl = user.logo_url ?? null;
      const primaryColor = user.primary_color ?? null;

      // Persist before flipping state so a crash mid-login cannot leave us
      // "authenticated" with nothing stored.
      await secureStorage.saveSession({
        token,
        user,
        biometricEnabled: false,
        organizationName: organizationName ?? undefined,
        logoUrl: logoUrl ?? undefined,
        primaryColor: primaryColor ?? undefined,
      });

      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
        biometricEnabled: false,
        organizationName,
        logoUrl,
        primaryColor,
      });

      scheduleTokenRefresh(token);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    const { token } = get();
    try {
      if (token) {
        await authApi.logout(token);
      }
    } catch {
      // Best-effort: a failed backend logout must not prevent local cleanup.
    }
    await clearLocalSession();
  },

  refreshToken: async () => {
    const { token } = get();
    if (!token) {
      return;
    }

    const { token: newToken } = await authApi.refreshToken(token);

    // Preserve the rest of the stored session (user + biometric flag + org name + branding).
    const session = await secureStorage.getSession();
    const user = session?.user ?? get().user;
    const biometricEnabled = session?.biometricEnabled ?? get().biometricEnabled;
    const organizationName = session?.organizationName ?? get().organizationName ?? undefined;
    const logoUrl = session?.logoUrl ?? get().logoUrl ?? undefined;
    const primaryColor = session?.primaryColor ?? get().primaryColor ?? undefined;

    if (user) {
      await secureStorage.saveSession({ token: newToken, user, biometricEnabled, organizationName, logoUrl, primaryColor });
    } else {
      await secureStorage.saveToken(newToken);
    }

    set({ token: newToken });
    scheduleTokenRefresh(newToken);
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const session = await secureStorage.getSession();
      if (session === null) {
        set({ ...LOGGED_OUT });
        return;
      }

      const expiryMs = decodeJwtExpiry(session.token);

      // Within (or past) the refresh window → attempt a silent refresh.
      if (expiryMs !== null && shouldRefreshToken(expiryMs, Date.now())) {
        try {
          const { token: newToken } = await authApi.refreshToken(session.token);
          await secureStorage.saveSession({ ...session, token: newToken });
          set({
            token: newToken,
            user: session.user,
            isAuthenticated: true,
            isLoading: false,
            biometricEnabled: false,
            organizationName: session.organizationName ?? null,
            logoUrl: session.logoUrl ?? null,
            primaryColor: session.primaryColor ?? null,
          });
          scheduleTokenRefresh(newToken);

          // Requirement 6.5: If cached organizationName is missing, fetch from API.
          if (!session.organizationName) {
            void fetchAndCacheOrganizationName(session, newToken);
          }
        } catch {
          // Requirement 1.6: refresh failed → clear and remain logged out.
          await clearLocalSession();
        }
        return;
      }

      // Valid token (or undecodable but present) → restore the session.
      set({
        token: session.token,
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
        biometricEnabled: false,
        organizationName: session.organizationName ?? null,
        logoUrl: session.logoUrl ?? null,
        primaryColor: session.primaryColor ?? null,
      });
      scheduleTokenRefresh(session.token);

      // Requirement 6.5: If cached organizationName is missing, fetch from API.
      if (!session.organizationName) {
        void fetchAndCacheOrganizationName(session, session.token);
      }
    } catch {
      // A Secure Storage read error means the session is unusable → force out.
      await clearLocalSession();
    }
  },

  enableBiometric: async () => {
    // Biometric login is currently disabled across the app.
    throw new Error('Biometric login is currently disabled');
  },

  disableBiometric: () => {
    // Biometric login is currently disabled across the app — no-op.
    set({ biometricEnabled: false });
  },
}));

// ---------------------------------------------------------------------------
// API client wiring (executed once on import — app bootstrap).
// ---------------------------------------------------------------------------

configureApiClient({
  // Prefer the in-memory token; fall back to Secure Storage so a request issued
  // before restoreSession completes still carries a bearer token.
  getToken: async () => {
    const inMemory = useAuthStore.getState().token;
    if (inMemory) {
      return inMemory;
    }
    try {
      return await secureStorage.getToken();
    } catch {
      return null;
    }
  },
  // Scope every request to the authenticated user's organization.
  getOrganizationId: () => useAuthStore.getState().user?.organization_id ?? null,
  // 401 → clear credentials locally and force a logged-out state (Req 1.6).
  // Local clear (no API call) avoids recursing into another 401.
  onUnauthorized: () => {
    void clearLocalSession();
  },
});

export default useAuthStore;
