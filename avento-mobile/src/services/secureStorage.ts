/**
 * Secure storage service for the Arixx mobile app.
 *
 * Wraps `expo-secure-store`, which persists values in the Android Keystore
 * (hardware-backed encryption where available). This module is the single
 * source of truth for the JWT token and the serialized {@link SecureSession}.
 *
 * Error handling strategy (see design.md "Error Handling"):
 * - Write failures throw {@link SecureStorageError} so callers can surface a
 *   re-authentication prompt.
 * - Read failures throw {@link SecureStorageError}; the auth store catches
 *   these and forces a logout, since a session that cannot be read safely is
 *   treated as no session at all.
 *
 * Validates: Requirements 1.2, 20.1, 20.3
 */

import * as SecureStore from 'expo-secure-store';

import type { AppUser } from '../types/auth';
import type { SecureSession } from '../types/api';

/** SecureStore keys used by the app. Keep in sync with {@link STORAGE_KEYS}. */
export const STORAGE_KEYS = {
  /** JWT bearer token. */
  TOKEN: 'avento.auth.token',
  /** JSON-serialized {@link SecureSession}. */
  SESSION: 'avento.auth.session',
} as const;

/** Every SecureStore key the app writes, used by {@link clearAll}. */
const ALL_KEYS: readonly string[] = [STORAGE_KEYS.TOKEN, STORAGE_KEYS.SESSION];

/**
 * Error thrown when a secure storage operation fails. The `operation` field
 * lets callers distinguish a read failure (force logout) from a write failure
 * (surface error / retry).
 */
export class SecureStorageError extends Error {
  readonly operation: 'read' | 'write' | 'delete';
  readonly cause?: unknown;

  constructor(operation: 'read' | 'write' | 'delete', message: string, cause?: unknown) {
    super(message);
    this.name = 'SecureStorageError';
    this.operation = operation;
    this.cause = cause;
  }
}

/**
 * Persist the JWT token.
 *
 * @throws {SecureStorageError} when the underlying write fails.
 */
export async function saveToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
  } catch (error) {
    throw new SecureStorageError('write', 'Failed to save auth token', error);
  }
}

/**
 * Retrieve the JWT token previously stored with {@link saveToken}.
 *
 * Returns the exact string that was saved, or `null` when no token is present.
 *
 * @throws {SecureStorageError} when the underlying read fails. Callers (the
 *   auth store) should treat this as a forced-logout condition.
 */
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
  } catch (error) {
    throw new SecureStorageError('read', 'Failed to read auth token', error);
  }
}

/**
 * Delete the stored JWT token. A missing key is not an error.
 *
 * @throws {SecureStorageError} when the underlying delete fails.
 */
export async function removeToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
  } catch (error) {
    throw new SecureStorageError('delete', 'Failed to remove auth token', error);
  }
}

/**
 * Persist the full session. The {@link AppUser} object is JSON-serialized into
 * the stored payload; the token is also mirrored to the dedicated token key so
 * the API client can read it independently via {@link getToken}.
 *
 * @throws {SecureStorageError} when the underlying write fails.
 */
export async function saveSession(session: SecureSession): Promise<void> {
  try {
    const payload = JSON.stringify({
      token: session.token,
      user: JSON.stringify(session.user),
      biometricEnabled: session.biometricEnabled,
      organizationName: session.organizationName ?? null,
      logoUrl: session.logoUrl ?? null,
      primaryColor: session.primaryColor ?? null,
    });
    await SecureStore.setItemAsync(STORAGE_KEYS.SESSION, payload);
    await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, session.token);
  } catch (error) {
    throw new SecureStorageError('write', 'Failed to save session', error);
  }
}

/**
 * Retrieve and deserialize the full session, or `null` when none is stored.
 *
 * @throws {SecureStorageError} when the read fails or the stored payload is
 *   malformed. The auth store treats this as a forced-logout condition.
 */
export async function getSession(): Promise<SecureSession | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(STORAGE_KEYS.SESSION);
  } catch (error) {
    throw new SecureStorageError('read', 'Failed to read session', error);
  }

  if (raw === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      token: string;
      user: string;
      biometricEnabled: boolean;
      organizationName?: string | null;
      logoUrl?: string | null;
      primaryColor?: string | null;
    };
    const user = JSON.parse(parsed.user) as AppUser;
    return {
      token: parsed.token,
      user,
      biometricEnabled: parsed.biometricEnabled,
      organizationName: parsed.organizationName ?? undefined,
      logoUrl: parsed.logoUrl ?? undefined,
      primaryColor: parsed.primaryColor ?? undefined,
    };
  } catch (error) {
    throw new SecureStorageError('read', 'Stored session is corrupted', error);
  }
}

/**
 * Remove every key the app stores in SecureStore (token + session). Used on
 * logout to guarantee no sensitive data is left behind.
 *
 * @throws {SecureStorageError} when any underlying delete fails.
 */
export async function clearAll(): Promise<void> {
  try {
    await Promise.all(ALL_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
  } catch (error) {
    throw new SecureStorageError('delete', 'Failed to clear secure storage', error);
  }
}

export const secureStorage = {
  saveToken,
  getToken,
  removeToken,
  saveSession,
  getSession,
  clearAll,
};

export default secureStorage;
