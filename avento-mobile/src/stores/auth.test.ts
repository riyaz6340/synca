/**
 * Unit tests for the auth store and its pure refresh-timing helpers.
 *
 * Covers: login (success + failure), logout (clears Secure Storage AND
 * AsyncStorage and resets state), restoreSession (no session / valid / expired
 * with successful refresh / expired with failed refresh), and the pure
 * shouldRefreshToken predicate (Property 8 boundary behavior).
 *
 * The network (authApi), Secure Storage, and biometric service are mocked so
 * the store logic is exercised in isolation. AsyncStorage uses the official
 * in-memory mock wired in src/__tests__/setup.ts.
 *
 * Validates: Requirements 1.2, 1.4, 1.5, 1.6, 1.7, 20.3
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { authApi } from '@/api/auth';
import { biometric } from '@/services/biometric';
import { secureStorage } from '@/services/secureStorage';
import type { AppUser } from '@/types/auth';
import type { SecureSession } from '@/types/api';

import {
  REFRESH_THRESHOLD_MS,
  cancelTokenRefresh,
  decodeJwtExpiry,
  shouldRefreshToken,
  useAuthStore,
} from './auth';

jest.mock('@/api/auth', () => ({
  authApi: {
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
  },
}));

jest.mock('@/services/secureStorage', () => ({
  secureStorage: {
    saveSession: jest.fn(),
    saveToken: jest.fn(),
    getSession: jest.fn(),
    getToken: jest.fn(),
    clearAll: jest.fn(),
  },
}));

jest.mock('@/services/biometric', () => ({
  biometric: {
    enable: jest.fn(),
    disable: jest.fn(),
  },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockSecureStorage = secureStorage as jest.Mocked<typeof secureStorage>;
const mockBiometric = biometric as jest.Mocked<typeof biometric>;

// --- Test fixtures ----------------------------------------------------------

const USER: AppUser = {
  id: 'user-1',
  email: 'admin@example.com',
  role: 'Admin',
  organization_id: 'org-1',
};

/** Build a JWT whose payload carries the given `exp` (seconds since epoch). */
function makeJwt(expSeconds: number): string {
  const b64 = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp: expSeconds, sub: USER.id })}.sig`;
}

/** A token that expires far in the future (no refresh due). */
function freshToken(): string {
  return makeJwt(Math.floor(Date.now() / 1000) + 3600);
}

function makeSession(token: string, biometricEnabled = false): SecureSession {
  return { token, user: USER, biometricEnabled };
}

const LOGGED_OUT = {
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  biometricEnabled: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  cancelTokenRefresh();
  useAuthStore.setState({ ...LOGGED_OUT });
  // Default happy-path resolutions; individual tests override as needed.
  mockSecureStorage.saveSession.mockResolvedValue(undefined);
  mockSecureStorage.saveToken.mockResolvedValue(undefined);
  mockSecureStorage.clearAll.mockResolvedValue(undefined);
});

afterEach(async () => {
  // Cancel any armed refresh timer so it cannot fire after the test ends.
  cancelTokenRefresh();
  await AsyncStorage.clear();
});

// --- shouldRefreshToken (Property 8 boundaries) -----------------------------

describe('shouldRefreshToken', () => {
  const now = 1_000_000_000_000;

  it('returns false when the token expires well beyond the 5-minute window', () => {
    expect(shouldRefreshToken(now + REFRESH_THRESHOLD_MS + 1, now)).toBe(false);
  });

  it('returns true exactly at the 5-minute boundary (<=)', () => {
    expect(shouldRefreshToken(now + REFRESH_THRESHOLD_MS, now)).toBe(true);
  });

  it('returns true when inside the window', () => {
    expect(shouldRefreshToken(now + 60_000, now)).toBe(true);
  });

  it('returns true when the token is already expired', () => {
    expect(shouldRefreshToken(now - 1, now)).toBe(true);
  });
});

describe('decodeJwtExpiry', () => {
  it('decodes the exp claim into milliseconds', () => {
    const token = makeJwt(1_700_000_000);
    expect(decodeJwtExpiry(token)).toBe(1_700_000_000_000);
  });

  it('returns null for a malformed token', () => {
    expect(decodeJwtExpiry('not-a-jwt')).toBeNull();
  });
});

// --- login ------------------------------------------------------------------

describe('login', () => {
  it('authenticates, persists the session, and sets authenticated state', async () => {
    const token = freshToken();
    mockAuthApi.login.mockResolvedValue({ token, user: USER });

    await useAuthStore
      .getState()
      .login('admin@example.com', 'pw', 'Example Org', 'org-1');

    expect(mockAuthApi.login).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'pw',
      organization_name: 'Example Org',
      organization_id: 'org-1',
    });
    expect(mockSecureStorage.saveSession).toHaveBeenCalledWith({
      token,
      user: USER,
      biometricEnabled: false,
    });

    const state = useAuthStore.getState();
    expect(state.token).toBe(token);
    expect(state.user).toEqual(USER);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('rethrows and stays unauthenticated when the API rejects', async () => {
    mockAuthApi.login.mockRejectedValue(new Error('invalid credentials'));

    await expect(
      useAuthStore.getState().login('a@b.com', 'bad', 'Org'),
    ).rejects.toThrow('invalid credentials');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.token).toBeNull();
    expect(mockSecureStorage.saveSession).not.toHaveBeenCalled();
  });
});

// --- logout -----------------------------------------------------------------

describe('logout', () => {
  it('calls the backend, clears both stores, and resets state', async () => {
    const token = freshToken();
    useAuthStore.setState({
      token,
      user: USER,
      isAuthenticated: true,
      isLoading: false,
      biometricEnabled: true,
    });
    await AsyncStorage.setItem('cached.something', 'value');
    mockAuthApi.logout.mockResolvedValue(undefined);

    await useAuthStore.getState().logout();

    expect(mockAuthApi.logout).toHaveBeenCalledWith(token);
    expect(mockSecureStorage.clearAll).toHaveBeenCalledTimes(1);
    await expect(AsyncStorage.getItem('cached.something')).resolves.toBeNull();

    const state = useAuthStore.getState();
    expect(state).toMatchObject(LOGGED_OUT);
  });

  it('still clears local data when the backend logout call fails', async () => {
    useAuthStore.setState({
      token: freshToken(),
      user: USER,
      isAuthenticated: true,
      isLoading: false,
      biometricEnabled: false,
    });
    mockAuthApi.logout.mockRejectedValue(new Error('network'));

    await useAuthStore.getState().logout();

    expect(mockSecureStorage.clearAll).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

// --- restoreSession ---------------------------------------------------------

describe('restoreSession', () => {
  it('remains logged out when no session is stored', async () => {
    mockSecureStorage.getSession.mockResolvedValue(null);

    await useAuthStore.getState().restoreSession();

    const state = useAuthStore.getState();
    expect(state).toMatchObject(LOGGED_OUT);
    expect(mockAuthApi.refreshToken).not.toHaveBeenCalled();
  });

  it('restores a still-valid session without refreshing', async () => {
    const token = freshToken();
    mockSecureStorage.getSession.mockResolvedValue(makeSession(token, true));

    await useAuthStore.getState().restoreSession();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(token);
    expect(state.user).toEqual(USER);
    expect(state.biometricEnabled).toBe(true);
    expect(mockAuthApi.refreshToken).not.toHaveBeenCalled();
  });

  it('silently refreshes a near-expiry token and restores the session', async () => {
    const nearExpiry = makeJwt(Math.floor(Date.now() / 1000) + 60); // 1 min left
    const refreshed = freshToken();
    mockSecureStorage.getSession.mockResolvedValue(makeSession(nearExpiry));
    mockAuthApi.refreshToken.mockResolvedValue({ token: refreshed });

    await useAuthStore.getState().restoreSession();

    expect(mockAuthApi.refreshToken).toHaveBeenCalledWith(nearExpiry);
    expect(mockSecureStorage.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ token: refreshed, user: USER }),
    );
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(refreshed);
  });

  it('clears credentials and stays logged out when refresh fails (Req 1.6)', async () => {
    const nearExpiry = makeJwt(Math.floor(Date.now() / 1000) + 60);
    mockSecureStorage.getSession.mockResolvedValue(makeSession(nearExpiry));
    mockAuthApi.refreshToken.mockRejectedValue(new Error('refresh failed'));

    await useAuthStore.getState().restoreSession();

    expect(mockSecureStorage.clearAll).toHaveBeenCalledTimes(1);
    const state = useAuthStore.getState();
    expect(state).toMatchObject(LOGGED_OUT);
  });

  it('forces logout when reading Secure Storage throws', async () => {
    mockSecureStorage.getSession.mockRejectedValue(new Error('read error'));

    await useAuthStore.getState().restoreSession();

    expect(mockSecureStorage.clearAll).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

// --- biometric preference ---------------------------------------------------

describe('biometric preference', () => {
  it('enableBiometric sets the flag when the service succeeds', async () => {
    mockBiometric.enable.mockResolvedValue({ success: true });

    await useAuthStore.getState().enableBiometric();

    expect(useAuthStore.getState().biometricEnabled).toBe(true);
  });

  it('enableBiometric throws and leaves the flag off when the service fails', async () => {
    mockBiometric.enable.mockResolvedValue({
      success: false,
      reason: 'authentication_failed',
    });

    await expect(useAuthStore.getState().enableBiometric()).rejects.toThrow(
      'authentication_failed',
    );
    expect(useAuthStore.getState().biometricEnabled).toBe(false);
  });

  it('disableBiometric clears the flag and calls the service', () => {
    useAuthStore.setState({ biometricEnabled: true });
    mockBiometric.disable.mockResolvedValue(true);

    useAuthStore.getState().disableBiometric();

    expect(useAuthStore.getState().biometricEnabled).toBe(false);
    expect(mockBiometric.disable).toHaveBeenCalledTimes(1);
  });
});
