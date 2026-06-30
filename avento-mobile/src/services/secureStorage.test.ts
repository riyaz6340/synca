/**
 * Unit tests for the secure storage service.
 *
 * `expo-secure-store` is mocked with an in-memory map so the round-trip and
 * error-handling behavior can be verified without native modules.
 *
 * Validates: Requirements 1.2, 20.1, 20.3
 */

import * as SecureStore from 'expo-secure-store';

import {
  STORAGE_KEYS,
  SecureStorageError,
  saveToken,
  getToken,
  removeToken,
  saveSession,
  getSession,
  clearAll,
} from './secureStorage';
import type { AppUser } from '../types/auth';
import type { SecureSession } from '../types/api';

// In-memory backing store for the mock.
let store: Map<string, string>;

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(() => {
  store = new Map<string, string>();

  mockSecureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
  });
  mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
    return store.has(key) ? (store.get(key) as string) : null;
  });
  mockSecureStore.deleteItemAsync.mockImplementation(async (key: string) => {
    store.delete(key);
  });
});

const sampleUser: AppUser = {
  id: 'user-1',
  email: 'admin@example.com',
  role: 'Admin',
  organization_id: 'org-1',
};

describe('token storage', () => {
  it('round-trips a saved token to the identical string', async () => {
    const token = 'eyJhbGciOiJIUzI1Niis.payload.signature';
    await saveToken(token);
    await expect(getToken()).resolves.toBe(token);
  });

  it('returns null when no token is stored', async () => {
    await expect(getToken()).resolves.toBeNull();
  });

  it('removes a stored token', async () => {
    await saveToken('abc');
    await removeToken();
    await expect(getToken()).resolves.toBeNull();
  });

  it('writes the token under the documented key', async () => {
    await saveToken('xyz');
    expect(store.get(STORAGE_KEYS.TOKEN)).toBe('xyz');
  });
});

describe('session storage', () => {
  it('round-trips a full session including the JSON-serialized user', async () => {
    const session: SecureSession = {
      token: 'session-token',
      user: sampleUser,
      biometricEnabled: true,
    };
    await saveSession(session);

    const restored = await getSession();
    expect(restored).toEqual(session);
  });

  it('mirrors the token so getToken works after saveSession', async () => {
    await saveSession({ token: 'mirror-token', user: sampleUser, biometricEnabled: false });
    await expect(getToken()).resolves.toBe('mirror-token');
  });

  it('returns null when no session is stored', async () => {
    await expect(getSession()).resolves.toBeNull();
  });

  it('throws a read SecureStorageError when the stored session is corrupted', async () => {
    store.set(STORAGE_KEYS.SESSION, 'not-valid-json');
    await expect(getSession()).rejects.toBeInstanceOf(SecureStorageError);
    await expect(getSession()).rejects.toMatchObject({ operation: 'read' });
  });
});

describe('clearAll', () => {
  it('removes both the token and the session', async () => {
    await saveSession({ token: 't', user: sampleUser, biometricEnabled: false });
    await clearAll();

    expect(store.has(STORAGE_KEYS.TOKEN)).toBe(false);
    expect(store.has(STORAGE_KEYS.SESSION)).toBe(false);
    await expect(getToken()).resolves.toBeNull();
    await expect(getSession()).resolves.toBeNull();
  });
});

describe('error handling', () => {
  it('wraps read failures as a catchable read SecureStorageError (force logout)', async () => {
    mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));
    await expect(getToken()).rejects.toMatchObject({
      name: 'SecureStorageError',
      operation: 'read',
    });
  });

  it('wraps write failures as a write SecureStorageError', async () => {
    mockSecureStore.setItemAsync.mockRejectedValueOnce(new Error('disk full'));
    await expect(saveToken('t')).rejects.toMatchObject({
      name: 'SecureStorageError',
      operation: 'write',
    });
  });

  it('wraps delete failures as a delete SecureStorageError', async () => {
    mockSecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('locked'));
    await expect(removeToken()).rejects.toMatchObject({
      name: 'SecureStorageError',
      operation: 'delete',
    });
  });
});
