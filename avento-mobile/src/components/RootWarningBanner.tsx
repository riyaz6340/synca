/**
 * RootWarningBanner — displays a prominent warning when the app detects
 * that the device is rooted/jailbroken.
 *
 * On mount, calls `isDeviceRooted()` from the root detection service. If the
 * result is `true`, renders a warning banner informing the user that their data
 * may be less secure. Renders nothing when the device is not rooted.
 *
 * Validates: Requirement 20.5
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isDeviceRooted } from '@/services/rootDetection';
import { colors, radius, spacing } from './theme';

const WARNING_MESSAGE =
  'This device appears to be rooted. Your data may be less secure.';

export interface RootWarningBannerProps {
  testID?: string;
}

export function RootWarningBanner({
  testID = 'root-warning-banner',
}: RootWarningBannerProps = {}): React.ReactElement | null {
  const [isRooted, setIsRooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isDeviceRooted().then((rooted) => {
      if (!cancelled) {
        setIsRooted(rooted);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isRooted) {
    return null;
  }

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={WARNING_MESSAGE}
      style={styles.banner}
    >
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.text}>{WARNING_MESSAGE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    margin: spacing.sm,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  icon: {
    marginRight: spacing.sm,
    fontSize: 14,
  },
  text: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default RootWarningBanner;
