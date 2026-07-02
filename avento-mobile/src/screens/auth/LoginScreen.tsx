/**
 * LoginScreen — the real credential-entry screen (task 8.1).
 *
 * Renders the unauthenticated login form:
 *  - An organization searchable dropdown populated from the public
 *    `/api/auth/organizations` endpoint (fetched on mount). Filtering is
 *    case-insensitive substring matching, handled by {@link SearchableDropdown}
 *    via the shared {@link filterByName} helper (Requirement 24.1, 24.2).
 *  - Email / login ID and password fields.
 *  - A submit button that is disabled until an organization is selected and
 *    both the email and password fields are non-empty, and that shows a loading
 *    state while the auth store is authenticating.
 *
 * On submit the screen delegates to `useAuthStore().login`, which authenticates
 * against the backend, persists the session, and stores the selected
 * organization context with the session (Requirement 24.3). Authentication
 * failures surface a friendly, generic message without exposing API internals
 * (Requirement 1.3).
 *
 * Validates: Requirements 1.1, 1.3, 24.1, 24.2, 24.3
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { authApi } from '@/api/auth';
import { SearchableDropdown } from '@/components/SearchableDropdown';
import { colors, radius, spacing } from '@/components/theme';
import { useAuthStore } from '@/stores/auth';
import type { Organization } from '@/types/models';

/** Generic, internals-free message shown for any authentication failure. */
const GENERIC_LOGIN_ERROR = 'Invalid credentials. Please try again.';
/** Message shown when the organization list could not be loaded. */
const ORG_LOAD_ERROR = 'Unable to load organizations. Pull to retry.';

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch the organization list once on mount (Requirement 24.1).
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const orgs = await authApi.fetchOrganizations();
        if (active) {
          setOrganizations(orgs);
          setOrgsError(null);
        }
      } catch {
        if (active) {
          setOrgsError(ORG_LOAD_ERROR);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // The form is valid once an org is chosen and both fields carry content.
  const isFormValid =
    selectedOrg !== null &&
    email.trim().length > 0 &&
    password.length > 0;

  const canSubmit = isFormValid && !isLoading;

  const onSubmit = async () => {
    if (!canSubmit || selectedOrg === null) {
      return;
    }
    setError(null);
    try {
      await login(email.trim(), password, selectedOrg.name, selectedOrg.id);
    } catch {
      // Never surface raw API/internal error details (Requirement 1.3).
      setError(GENERIC_LOGIN_ERROR);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Arixx
      </Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Organization</Text>
        <SearchableDropdown
          items={organizations}
          getLabel={(org) => org.name}
          getKey={(org) => org.id}
          selected={selectedOrg}
          onSelect={setSelectedOrg}
          placeholder="Select organization"
          searchPlaceholder="Search organizations…"
          emptyText="No organizations found"
          testID="organization-dropdown"
        />
        {orgsError !== null && <Text style={styles.error}>{orgsError}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Email / Login ID</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email or login ID"
          testID="login-email"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
          testID="login-password"
        />
      </View>

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        testID="login-submit"
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});
