/**
 * Unit tests for the biometric authentication service.
 *
 * `expo-local-authentication` is mocked so prompt/hardware behavior can be
 * driven deterministically, and `secureStorage` is backed by an in-memory
 * session so the enable/disable preference round-trips can be verified without
 * native modules.
 *
 * Validates: Requirements 1.8, 1.9
 */

import * as LocalAuthentication from 'expo-local-authentication';

import {
  checkAvailability,
  authenticate,
  enable,
  disable,
  isBiometricEnabled,
} from './biometric';
import * as secureStorage from './secureStorage';
import type { SecureSession } from '../types/api';
import type { AppUser } from '../types/auth';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

const mockLA = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

const sampleUser: AppUser = {
  id: 'user-1',
  email: 'admin@example.com',
  role: 'Admin',
  organization_id: 'org-1',
};

// In-memory session backing the secureStorage mock.
let sessionStore: SecureSession | null;

beforeEach(() => {
  sessionStore = null;

  jest
    .spyOn(secureStorage, 'getSession')
    .mockImplementation(async () => sessionStore);
  jest
    .spyOn(secureStorage, 'saveSession')
    .mockImplementation(async (session: SecureSession) => {
      sessionStore = session;
    });

  // Default happy-path: hardware present, enrolled, fingerprint supported.
  mockLA.hasHardwareAsync.mockResolvedValue(true);
  mockLA.isEnrolledAsync.mockResolvedValue(true);
  mockLA.supportedAuthenticationTypesAsync.mockResolvedValue([
    LocalAuthentication.AuthenticationType.FINGERPRINT,
  ]);
  mockLA.authenticateAsync.mockResolvedValue({ success: true });
});

describe('checkAvailability', () => {
  it('reports available when hardware exists and a biometric is enrolled', async () => {
    const result = await checkAvailability();
    expect(result.available).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.supportedTypes).toEqual([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);
  });

  it('reports no_hardware when the device has no biometric sensor', async () => {
    mockLA.hasHardwareAsync.mockResolvedValue(false);
    const result = await checkAvailability();
    expect(result).toEqual({
      available: false,
      reason: 'no_hardware',
      supportedTypes: [],
    });
    // Should short-circuit before checking enrollment.
    expect(mockLA.isEnrolledAsync).not.toHaveBeenCalled();
  });

  it('reports not_enrolled when hardware exists but nothing is enrolled', async () => {
    mockLA.isEnrolledAsync.mockResolvedValue(false);
    const result = await checkAvailability();
    expect(result.available).toBe(false);
    expect(result.reason).toBe('not_enrolled');
  });

  it('reports unknown (not available) when a native call throws', async () => {
    mockLA.hasHardwareAsync.mockRejectedValue(new Error('native failure'));
    const result = await checkAvailability();
    expect(result).toEqual({
      available: false,
      reason: 'unknown',
      supportedTypes: [],
    });
  });
});

describe('authenticate', () => {
  it('returns true when the biometric prompt succeeds', async () => {
    await expect(authenticate()).resolves.toBe(true);
    expect(mockLA.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('returns false when the prompt fails or is cancelled', async () => {
    mockLA.authenticateAsync.mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });
    await expect(authenticate()).resolves.toBe(false);
  });

  it('returns false without prompting when hardware is unavailable', async () => {
    mockLA.hasHardwareAsync.mockResolvedValue(false);
    await expect(authenticate()).resolves.toBe(false);
    expect(mockLA.authenticateAsync).not.toHaveBeenCalled();
  });

  it('returns false when the native prompt throws', async () => {
    mockLA.authenticateAsync.mockRejectedValue(new Error('boom'));
    await expect(authenticate()).resolves.toBe(false);
  });

  it('keeps the prompt biometric-only by default', async () => {
    await authenticate({ promptMessage: 'Unlock' });
    expect(mockLA.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Unlock',
        disableDeviceFallback: true,
      }),
    );
  });

  it('allows device credential fallback when requested', async () => {
    await authenticate({ allowDeviceCredentialFallback: true });
    expect(mockLA.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: false }),
    );
  });
});

describe('enable', () => {
  it('persists biometricEnabled=true after a successful prompt', async () => {
    sessionStore = { token: 't', user: sampleUser, biometricEnabled: false };

    const result = await enable();

    expect(result).toEqual({ success: true });
    expect(sessionStore).toEqual({
      token: 't',
      user: sampleUser,
      biometricEnabled: true,
    });
    await expect(isBiometricEnabled()).resolves.toBe(true);
  });

  it('fails with the availability reason when hardware is unavailable', async () => {
    mockLA.isEnrolledAsync.mockResolvedValue(false);
    sessionStore = { token: 't', user: sampleUser, biometricEnabled: false };

    const result = await enable();

    expect(result).toEqual({ success: false, reason: 'not_enrolled' });
    expect(mockLA.authenticateAsync).not.toHaveBeenCalled();
    expect(sessionStore.biometricEnabled).toBe(false);
  });

  it('fails with authentication_failed when the prompt is not passed', async () => {
    mockLA.authenticateAsync.mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });
    sessionStore = { token: 't', user: sampleUser, biometricEnabled: false };

    const result = await enable();

    expect(result).toEqual({ success: false, reason: 'authentication_failed' });
    expect(sessionStore.biometricEnabled).toBe(false);
  });

  it('fails with no_session when there is no stored session', async () => {
    sessionStore = null;

    const result = await enable();

    expect(result).toEqual({ success: false, reason: 'no_session' });
  });
});

describe('disable', () => {
  it('clears the biometricEnabled flag on the stored session', async () => {
    sessionStore = { token: 't', user: sampleUser, biometricEnabled: true };

    await expect(disable()).resolves.toBe(true);
    expect(sessionStore.biometricEnabled).toBe(false);
    await expect(isBiometricEnabled()).resolves.toBe(false);
  });

  it('is a no-op resolving true when there is no session', async () => {
    sessionStore = null;
    await expect(disable()).resolves.toBe(true);
    expect(secureStorage.saveSession).not.toHaveBeenCalled();
  });
});

describe('isBiometricEnabled', () => {
  it('returns false when no session exists', async () => {
    sessionStore = null;
    await expect(isBiometricEnabled()).resolves.toBe(false);
  });

  it('reflects the stored preference', async () => {
    sessionStore = { token: 't', user: sampleUser, biometricEnabled: true };
    await expect(isBiometricEnabled()).resolves.toBe(true);
  });
});
