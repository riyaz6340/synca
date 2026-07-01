/**
 * PermissionDeniedScreen — displayed when a Teacher navigates to a screen
 * they lack the required permission for.
 *
 * Shows the specific missing permission name and a note to contact Admin.
 *
 * Validates: Requirements 1.6, 4.5
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from './theme';

export interface PermissionDeniedScreenProps {
  /** The permission that is required but missing. */
  permission: string;
  testID?: string;
}

export function PermissionDeniedScreen({
  permission,
  testID = 'permission-denied-screen',
}: PermissionDeniedScreenProps): React.ReactElement {
  return (
    <View testID={testID} style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Permission Denied</Text>
      <Text style={styles.message}>
        You don't have permission: <Text style={styles.bold}>{permission}</Text>
      </Text>
      <Text style={styles.hint}>
        Please contact your Admin to request access.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PermissionDeniedScreen;
