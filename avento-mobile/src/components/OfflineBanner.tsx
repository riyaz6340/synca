/**
 * OfflineBanner — a network-status indicator rendered above cached content
 * when the device is offline, warning the user that the data may be outdated.
 *
 * Stays presentational: callers pass an `offline` flag (typically wired to
 * NetInfo connectivity state) so this component has no platform dependencies
 * and is trivial to test.
 *
 * Validates: Requirements 3.5, 21.1
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from './theme';

export interface OfflineBannerProps {
  /** When false, the banner renders nothing. */
  offline: boolean;
  /** Optional override message. */
  message?: string;
  testID?: string;
}

export function OfflineBanner({
  offline,
  message = 'You are offline. Showing cached data that may be outdated.',
  testID = 'offline-banner',
}: OfflineBannerProps): React.ReactElement | null {
  if (!offline) {
    return null;
  }

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={message}
      style={styles.banner}
    >
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSurface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    margin: spacing.sm,
  },
  icon: {
    marginRight: spacing.sm,
    fontSize: 14,
  },
  text: {
    flex: 1,
    color: colors.warningText,
    fontSize: 13,
    fontWeight: '500',
  },
});

export default OfflineBanner;
