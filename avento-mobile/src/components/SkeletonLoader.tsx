/**
 * SkeletonLoader — placeholder blocks shown while data-fetching screens load,
 * instead of a blank screen or a full-screen spinner.
 *
 * Provides a primitive `SkeletonBlock` plus a `SkeletonLoader` that renders a
 * configurable number of list-row placeholders with a subtle pulsing opacity.
 *
 * Validates: Requirement 23.3
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from './theme';

export interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A single pulsing rectangle placeholder. */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}: SkeletonBlockProps): React.ReactElement {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityRole="none"
      style={[
        { width, height, borderRadius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

export interface SkeletonLoaderProps {
  /** Number of placeholder rows to render. */
  count?: number;
  testID?: string;
}

/** A list of row-shaped skeleton placeholders for data-fetching screens. */
export function SkeletonLoader({
  count = 5,
  testID = 'skeleton-loader',
}: SkeletonLoaderProps): React.ReactElement {
  return (
    <View testID={testID} accessibilityLabel="Loading" style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.row}>
          <SkeletonBlock width={48} height={48} borderRadius={radius.md} />
          <View style={styles.rowBody}>
            <SkeletonBlock width="70%" height={14} />
            <SkeletonBlock width="45%" height={12} style={styles.secondLine} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  rowBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  secondLine: {
    marginTop: spacing.sm,
  },
});

export default SkeletonLoader;
