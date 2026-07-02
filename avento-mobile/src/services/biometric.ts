/**
 * Biometric authentication service for the Arixx mobile app.
 *
 * Wraps `expo-local-authentication` (which bridges the Android BiometricPrompt)
 * to provide a small, testable surface for the auth flow:
 *
 * - {@link checkAvailability} — does the device have biometric hardware that is
 *   also enrolled? Returns a structured result with a reason when unavailable.
 * - {@link authenticate} — trigger the system biometric prompt and report
 *   whether the user verified successfully.
 * - {@link enable} / {@link disable} — manage the `biometricEnabled` preference.
 *   Per the design, the canonical persistence lives in the {@link SecureSession}
 *   (Secure Storage). These methods coordinate with `secureStorage`: `enable`
 *   first confirms hardware availability and a successful biometric prompt, then
 *   flips the stored flag; `disable` simply clears it. The Zustand auth store
 *   calls these as thin wrappers and mirrors the flag into its in-memory state.
 *
 * Every path degrades gracefully: when hardware is missing or not enrolled, or
 * when a native call throws, callers receive `false` / an `available: false`
 * result rather than an exception.
 *
 * Validates: Requirements 1.8, 1.9
 */

import * as LocalAuthentication from 'expo-local-authentication';

import { getSession, saveSession } from './secureStorage';

/** Why biometric authentication is not currently usable on this device. */
export type BiometricUnavailableReason =
  /** Device has no biometric sensor (fingerprint/face) at all. */
  | 'no_hardware'
  /** Hardware exists but the user has not enrolled any biometrics. */
  | 'not_enrolled'
  /** A native call failed unexpectedly; treated as unavailable. */
  | 'unknown';

/** Structured result describing whether biometric auth can be used. */
export interface BiometricAvailability {
  /** True only when hardware exists AND at least one biometric is enrolled. */
  available: boolean;
  /** Populated when {@link available} is false. */
  reason?: BiometricUnavailableReason;
  /**
   * The biometric types the device supports (e.g. fingerprint, facial). Empty
   * when unavailable or undeterminable.
   */
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

/** Why an {@link enable} attempt did not succeed. */
export type BiometricEnableFailureReason =
  | BiometricUnavailableReason
  /** The user cancelled or failed the biometric prompt. */
  | 'authentication_failed'
  /** No authenticated session exists to attach the preference to. */
  | 'no_session';

/** Result of attempting to {@link enable} biometric login. */
export interface BiometricEnableResult {
  success: boolean;
  reason?: BiometricEnableFailureReason;
}

/** Options forwarded to the system biometric prompt. */
export interface AuthenticateOptions {
  /** Message shown in the prompt. Defaults to a generic unlock string. */
  promptMessage?: string;
  /**
   * When true, the OS may offer the device passcode/PIN as a fallback. Defaults
   * to false so the prompt stays biometric-only; the app provides its own
   * credential-login fallback at the screen level.
   */
  allowDeviceCredentialFallback?: boolean;
}

const DEFAULT_PROMPT_MESSAGE = 'Verify your identity to continue';

/**
 * Determine whether biometric authentication is available for use.
 *
 * Available means the device both has biometric hardware
 * (`hasHardwareAsync`) and has at least one biometric enrolled
 * (`isEnrolledAsync`). Any native error is swallowed and reported as
 * `{ available: false, reason: 'unknown' }` so callers never have to guard
 * against exceptions.
 */
export async function checkAvailability(): Promise<BiometricAvailability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, reason: 'no_hardware', supportedTypes: [] };
    }

    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return { available: false, reason: 'not_enrolled', supportedTypes };
    }

    return { available: true, supportedTypes };
  } catch {
    return { available: false, reason: 'unknown', supportedTypes: [] };
  }
}

/**
 * Trigger the system biometric prompt.
 *
 * Returns `true` only when the user successfully verifies. Returns `false` when
 * the device is unavailable (no hardware / not enrolled), the user cancels or
 * fails, or a native error occurs — never throws.
 */
export async function authenticate(
  options: AuthenticateOptions = {},
): Promise<boolean> {
  const availability = await checkAvailability();
  if (!availability.available) {
    return false;
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: options.promptMessage ?? DEFAULT_PROMPT_MESSAGE,
      disableDeviceFallback: !options.allowDeviceCredentialFallback,
    });
    return result.success === true;
  } catch {
    return false;
  }
}

/**
 * Enable biometric login.
 *
 * Confirms the device is available and that the user can pass a live biometric
 * prompt, then persists `biometricEnabled: true` onto the stored
 * {@link SecureSession}. Fails (without mutating storage) when biometrics are
 * unavailable, the prompt is not passed, or there is no session to attach the
 * preference to.
 */
export async function enable(
  options: AuthenticateOptions = {},
): Promise<BiometricEnableResult> {
  const availability = await checkAvailability();
  if (!availability.available) {
    return { success: false, reason: availability.reason ?? 'unknown' };
  }

  const verified = await authenticate({
    promptMessage: options.promptMessage ?? 'Verify to enable biometric login',
    allowDeviceCredentialFallback: options.allowDeviceCredentialFallback,
  });
  if (!verified) {
    return { success: false, reason: 'authentication_failed' };
  }

  const session = await getSession();
  if (session === null) {
    return { success: false, reason: 'no_session' };
  }

  await saveSession({ ...session, biometricEnabled: true });
  return { success: true };
}

/**
 * Disable biometric login by clearing the `biometricEnabled` flag on the stored
 * session. A no-op (resolving `true`) when no session exists, since there is
 * nothing left to gate. Returns `true` once the preference is off.
 */
export async function disable(): Promise<boolean> {
  const session = await getSession();
  if (session === null) {
    return true;
  }

  if (session.biometricEnabled) {
    await saveSession({ ...session, biometricEnabled: false });
  }
  return true;
}

/**
 * Read the persisted biometric preference. Returns `false` when no session
 * exists. Provided so the auth store / biometric gate can decide whether to
 * prompt on launch without reaching into Secure Storage internals.
 */
export async function isBiometricEnabled(): Promise<boolean> {
  const session = await getSession();
  return session?.biometricEnabled ?? false;
}

export const biometric = {
  checkAvailability,
  authenticate,
  enable,
  disable,
  isBiometricEnabled,
};

export default biometric;
