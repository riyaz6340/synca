/**
 * BiometricScreen — the biometric unlock gate.
 *
 * Shown by {@link RootNavigator} when a session was restored AND the user has
 * biometric login enabled (Requirement 1.9). On mount it first confirms the
 * device can still do biometrics ({@link biometric.checkAvailability}) and then
 * triggers the system biometric prompt ({@link biometric.authenticate}):
 *
 *  - **Success** → calls {@link BiometricScreenProps.onAuthenticated} to lift
 *    the gate and reveal the role-based tabs.
 *  - **Failure / cancel** → shows a "Try again" affordance that re-invokes the
 *    prompt, plus a credential-login fallback (Requirement 1.8).
 *  - **Unavailable** (hardware missing or enrollment removed since login) →
 *    skips the pointless retry and gracefully steers the user to credential
 *    login, so they can never be locked out of their account.
 *
 * The screen always offers the fallback path (sign out → credential login) via
 * {@link BiometricScreenProps.onFallback}.
 *
 * Validates: Requirements 1.8, 1.9
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { biometric } from '@/services/biometric';

export interface BiometricScreenProps {
  /** Invoked once the user successfully passes the biometric prompt. */
  onAuthenticated: () => void;
  /**
   * Invoked when the user chooses to abandon biometric verification and sign in
   * with credentials instead (typically wired to the auth store's logout).
   */
  onFallback: () => void;
}

/**
 * The gate's lifecycle phase, which drives what the screen renders:
 *  - `checking`    — confirming biometric availability on the device.
 *  - `prompting`   — the system biometric dialog is up; awaiting the result.
 *  - `failed`      — verification did not complete; offer retry + fallback.
 *  - `unavailable` — biometrics can no longer be used; offer fallback only.
 */
type Phase = 'checking' | 'prompting' | 'failed' | 'unavailable';

export default function BiometricScreen({
  onAuthenticated,
  onFallback,
}: BiometricScreenProps) {
  const [phase, setPhase] = useState<Phase>('checking');

  const runPrompt = useCallback(async () => {
    setPhase('checking');

    // Re-confirm availability every attempt: a user may have removed their
    // enrollment after logging in, in which case retrying the prompt is futile
    // and we route them to credential login instead (graceful degradation).
    const availability = await biometric.checkAvailability();
    if (!availability.available) {
      setPhase('unavailable');
      return;
    }

    setPhase('prompting');
    const ok = await biometric.authenticate({ promptMessage: 'Unlock Avento' });
    if (ok) {
      onAuthenticated();
    } else {
      setPhase('failed');
    }
  }, [onAuthenticated]);

  useEffect(() => {
    void runPrompt();
  }, [runPrompt]);

  const isBusy = phase === 'checking' || phase === 'prompting';

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Unlock Avento
      </Text>

      {isBusy ? (
        <>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.hint}>Verifying your identity…</Text>
        </>
      ) : (
        <>
          {phase === 'failed' && (
            <Text style={styles.error}>Verification was not completed.</Text>
          )}
          {phase === 'unavailable' && (
            <Text style={styles.error}>
              Biometric login is unavailable on this device. Sign in with your
              password to continue.
            </Text>
          )}

          {/* Retrying only makes sense when the prompt itself failed; when
              biometrics are unavailable the retry is hidden. */}
          {phase === 'failed' && (
            <TouchableOpacity
              style={styles.button}
              onPress={() => void runPrompt()}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Try again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={phase === 'failed' ? styles.secondaryButton : styles.button}
            onPress={onFallback}
            accessibilityRole="button"
          >
            <Text
              style={
                phase === 'failed'
                  ? styles.secondaryButtonText
                  : styles.buttonText
              }
            >
              Use password instead
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  hint: { marginTop: 16, color: '#666', fontSize: 16 },
  error: {
    color: '#c0392b',
    marginBottom: 16,
    fontSize: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 12,
    minWidth: 220,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 32 },
  secondaryButtonText: { color: '#2563eb', fontSize: 15, fontWeight: '500' },
});
