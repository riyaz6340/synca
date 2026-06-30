/**
 * Root Detection Service
 *
 * Provides a best-effort heuristic to detect whether the device is rooted/jailbroken.
 *
 * Design decisions:
 * - The project does NOT include a native root-detection library (e.g. rootbeer,
 *   SafetyNet, expo-device `isRootedExperimentalAsync`). Adding one would require
 *   a dev-client build and native linking, which is beyond what the current Expo
 *   Go / managed workflow supports.
 * - This module therefore defaults to returning `false` (not rooted) but exposes
 *   an injectable override (`_setDetector`) so that:
 *     1. A real native detector can be plugged in later without touching consumers.
 *     2. Tests can deterministically control the return value.
 * - When a native library is added in the future, simply call `_setDetector()`
 *   from app initialisation with the real implementation.
 *
 * Validates: Requirement 20.5
 */

/** Signature for a root-detection implementation. */
export type RootDetector = () => Promise<boolean>;

/**
 * Default detector — returns false (safe fallback when no native library is
 * available).
 */
const defaultDetector: RootDetector = async () => false;

/** Internal mutable reference to the active detector. */
let _detector: RootDetector = defaultDetector;

/**
 * Replace the active root-detection implementation.
 *
 * Call this at startup to wire in a real native detector, or from tests to
 * inject a deterministic result.
 */
export function _setDetector(detector: RootDetector): void {
  _detector = detector;
}

/**
 * Reset the detector to the default (useful in test teardown).
 */
export function _resetDetector(): void {
  _detector = defaultDetector;
}

/**
 * Returns `true` if the device appears to be rooted/jailbroken.
 *
 * In the current implementation (no native library), this always resolves to
 * `false`. Swap the detector via `_setDetector()` to enable real detection.
 */
export async function isDeviceRooted(): Promise<boolean> {
  return _detector();
}
