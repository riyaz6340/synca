/**
 * EmptyState — a centered message shown when a list or screen has no data.
 *
 * Supports an optional icon (any string/emoji or node), a title, a message,
 * and an optional action button (e.g. "Add" / "Refresh").
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from './theme';

export interface EmptyStateProps {
  title?: string;
  message: string;
  /** Emoji/string icon or a custom React node. */
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
  testID = 'empty-state',
}: EmptyStateProps): React.ReactElement {
  return (
    <View testID={testID} style={styles.container}>
      {icon != null ? (
        typeof icon === 'string' ? (
          <Text style={styles.icon}>{icon}</Text>
        ) : (
          icon
        )
      ) : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.button}
          testID="empty-state-action"
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default EmptyState;
