import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from './theme';

export function CalendarLegend(): React.ReactElement {
  return (
    <View style={styles.container} testID="calendar-legend">
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: colors.present }]} />
        <Text style={styles.label}>Marked</Text>
      </View>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: colors.border }]} />
        <Text style={styles.label}>Unmarked</Text>
      </View>
    </View>
  );
}

export default CalendarLegend;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
