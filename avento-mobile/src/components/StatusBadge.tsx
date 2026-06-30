/**
 * StatusBadge — a color-coded pill showing a person's presence status.
 *
 * Accepts any PresenceStatus / DisplayPresenceStatus (plus the common
 * "Not Marked" variant) and maps it to a consistent color + label:
 *   green = Present, red = Absent, yellow = Late, blue = On Leave,
 *   gray = Not Marked / Not yet marked.
 *
 * Validates: Requirement 3.2
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { DisplayPresenceStatus, PresenceStatus } from '../types/models';
import { colors, getStatusVisual, radius, spacing } from './theme';

export interface StatusBadgeProps {
  status: PresenceStatus | DisplayPresenceStatus | 'Not Marked' | null | undefined;
  /** Optional override label (defaults to the mapped status label). */
  label?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function StatusBadge({
  status,
  label,
  size = 'md',
  style,
  testID,
}: StatusBadgeProps): React.ReactElement {
  const visual = getStatusVisual(status);
  const isSmall = size === 'sm';

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label ?? visual.label}`}
      style={[
        styles.badge,
        {
          backgroundColor: visual.color,
          paddingVertical: isSmall ? spacing.xs / 2 : spacing.xs,
          paddingHorizontal: isSmall ? spacing.sm : spacing.md,
        },
        style,
      ]}
    >
      <Text style={[styles.text, isSmall && styles.textSmall]} numberOfLines={1}>
        {label ?? visual.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
  },
  text: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 13,
  },
  textSmall: {
    fontSize: 11,
  },
});

export default StatusBadge;
