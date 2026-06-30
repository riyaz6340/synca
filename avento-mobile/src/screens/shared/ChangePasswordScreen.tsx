/**
 * ChangePasswordScreen — the shared change-password form for Parent, Admin and
 * SuperAdmin profile stacks (task 9.9).
 *
 * Behaviour:
 *  - Renders current password, new password and confirm new password fields
 *    (Requirement 8.1).
 *  - Gates submission via the pure {@link validatePasswordChange} helper: the
 *    submit button is enabled IF AND ONLY IF the new password is at least 6
 *    characters AND equals the confirmation (Requirement 8.2 / Property 14).
 *    On an invalid attempt a field-level error is shown and NO API call is made.
 *  - Submits a valid change via `authApi.changePassword({ current_password,
 *    new_password })` using a React Query mutation.
 *  - When the backend rejects the current password (401/400) it shows a
 *    friendly "Current password is incorrect" message (Requirement 8.3); other
 *    failures show a generic retry message.
 *  - On success it shows a success message and navigates back to Profile
 *    (Requirement 8.4).
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';

import { authApi, type ChangePasswordInput } from '@/api/auth';
import { colors, radius, spacing } from '@/components/theme';
import {
  validatePasswordChange,
} from '@/utils/passwordValidation';

/** Narrow an unknown thrown value to its HTTP status code, if present. */
function errorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status;
  }
  return undefined;
}

export default function ChangePasswordScreen(): React.ReactElement {
  const navigation = useNavigation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: ChangePasswordInput) => authApi.changePassword(input),
    onSuccess: () => {
      setSubmitError(null);
    },
    onError: (error: unknown) => {
      const status = errorStatus(error);
      // A 400/401 from the change-password endpoint means the supplied current
      // password did not match (Requirement 8.3).
      if (status === 400 || status === 401) {
        setSubmitError('Current password is incorrect.');
      } else {
        setSubmitError('Could not change your password. Please try again.');
      }
    },
  });

  // Property 14: the form is submittable iff the new password is valid.
  const validation = validatePasswordChange({ newPassword, confirmPassword });
  const canSubmit =
    validation.valid && currentPassword.length > 0 && !mutation.isPending;

  // Live, field-level validation hints. These surface as the user types so the
  // reason the submit button is gated is always visible, without requiring a
  // (blocked) press. An error is only shown once the relevant field has input.
  const newPasswordError =
    newPassword.length > 0 && validation.field === 'newPassword'
      ? validation.error
      : undefined;
  const confirmPasswordError =
    confirmPassword.length > 0 && validation.field === 'confirmPassword'
      ? validation.error
      : undefined;

  const onSubmit = (): void => {
    setSubmitError(null);
    if (!canSubmit) {
      return;
    }
    mutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  if (mutation.isSuccess) {
    return (
      <View style={styles.successContainer} testID="change-password-success">
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Password changed</Text>
        <Text style={styles.successMessage}>
          Your password has been updated successfully.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          testID="change-password-success-done"
        >
          <Text style={styles.buttonText}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="change-password-screen">
      <View style={styles.field}>
        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Enter current password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          testID="change-password-current"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="At least 6 characters"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          testID="change-password-new"
        />
        {newPasswordError ? (
          <Text style={styles.error} testID="change-password-error-new">
            {newPasswordError}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter new password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          testID="change-password-confirm"
        />
        {confirmPasswordError ? (
          <Text style={styles.error} testID="change-password-error-confirm">
            {confirmPasswordError}
          </Text>
        ) : null}
      </View>

      {submitError ? (
        <Text style={styles.error} testID="change-password-submit-error">
          {submitError}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        testID="change-password-submit"
      >
        {mutation.isPending ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Change Password</Text>
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
  field: {
    marginBottom: spacing.lg,
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
    fontSize: 13,
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
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
