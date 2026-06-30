/**
 * ProfileScreen — the shared profile tab for Parent, Admin and SuperAdmin
 * (task 9.9).
 *
 * Behaviour:
 *  - Shows the authenticated user's info (email + role) read from the Zustand
 *    auth store (`useAuthStore`).
 *  - Offers a "Change Password" affordance that navigates to the
 *    `ChangePassword` screen within the current profile stack (Requirement 8.1).
 *  - Renders a biometric-login toggle ONLY when the device actually has
 *    biometric hardware enrolled — availability is probed once on mount via
 *    `biometric.checkAvailability` (Requirement 1.8). The toggle reflects the
 *    store's `biometricEnabled` flag and calls `enableBiometric` /
 *    `disableBiometric`.
 *  - Provides a logout button that calls the store's `logout`, clearing the
 *    session (Requirement 1.7).
 *
 * The screen is role-agnostic: it relies only on the auth store and the shared
 * biometric service, so all three profile stacks can mount it directly.
 *
 * Validates: Requirements 8.1, 1.7, 1.8
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { colors, radius, spacing } from '@/components/theme';
import { biometric } from '@/services/biometric';
import { useAuthStore } from '@/stores/auth';
import type { AppRole } from '@/types/auth';

/** Human-friendly label for each role. */
const ROLE_LABELS: Record<AppRole, string> = {
  Admin: 'Administrator',
  SuperAdmin: 'Super Administrator',
  Stakeholder: 'Parent',
};

function roleLabel(role: AppRole | undefined): string {
  return role ? ROLE_LABELS[role] : 'User';
}

export default function ProfileScreen(): React.ReactElement {
  const navigation = useNavigation();

  const user = useAuthStore((s) => s.user);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const enableBiometric = useAuthStore((s) => s.enableBiometric);
  const disableBiometric = useAuthStore((s) => s.disableBiometric);
  const logout = useAuthStore((s) => s.logout);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Probe biometric availability once; only then do we reveal the toggle so it
  // never appears on devices without enrolled biometric hardware.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await biometric.checkAvailability();
        if (active) {
          setBiometricAvailable(result.available);
        }
      } catch {
        if (active) {
          setBiometricAvailable(false);
        }
      } finally {
        if (active) {
          setBiometricChecked(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onToggleBiometric = async (next: boolean): Promise<void> => {
    setToggleError(null);
    if (next) {
      setToggleBusy(true);
      try {
        await enableBiometric();
      } catch {
        setToggleError('Could not enable biometric login. Please try again.');
      } finally {
        setToggleBusy(false);
      }
    } else {
      disableBiometric();
    }
  };

  const onLogout = async (): Promise<void> => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      // The root navigator swaps to the auth stack once the session clears; if
      // logout rejects we still re-enable the button so the user can retry.
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.container} testID="profile-screen">
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.email ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.email} testID="profile-email">
          {user?.email ?? 'Unknown user'}
        </Text>
        <Text style={styles.role} testID="profile-role">
          {roleLabel(user?.role)}
        </Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('ChangePassword' as never)}
          accessibilityRole="button"
          testID="profile-change-password"
        >
          <Text style={styles.rowLabel}>Change Password</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {biometricChecked && biometricAvailable ? (
          <View style={styles.row} testID="profile-biometric-row">
            <Text style={styles.rowLabel}>Biometric login</Text>
            {toggleBusy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={biometricEnabled}
                onValueChange={(next) => void onToggleBiometric(next)}
                testID="profile-biometric-toggle"
                accessibilityRole="switch"
                accessibilityState={{ checked: biometricEnabled }}
              />
            )}
          </View>
        ) : null}

        {toggleError ? (
          <Text style={styles.error} testID="profile-biometric-error">
            {toggleError}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, loggingOut && styles.buttonDisabled]}
        onPress={() => void onLogout()}
        disabled={loggingOut}
        accessibilityRole="button"
        accessibilityState={{ disabled: loggingOut }}
        testID="profile-logout"
      >
        {loggingOut ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <Text style={styles.logoutText}>Log Out</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.primaryText,
    fontSize: 30,
    fontWeight: '700',
  },
  email: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  role: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontSize: 15,
    color: colors.text,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  logoutButton: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
