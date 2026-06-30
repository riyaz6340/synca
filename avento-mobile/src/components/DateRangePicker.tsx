/**
 * DateRangePicker — a start/end date selection control used by the attendance
 * history and reports screens.
 *
 * Implementation note: the project does not depend on
 * `@react-native-community/datetimepicker`, so to stay dependency-light this
 * uses minimal text inputs constrained to the ISO `YYYY-MM-DD` format (the same
 * format the backend expects for `start_date` / `end_date` query params). It
 * validates the format and that start <= end, surfacing a field-level error.
 * A native calendar picker can be dropped in later behind the same props.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from './theme';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a well-formed, real calendar date in YYYY-MM-DD form. */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** Validate a range; returns an error string or null when the range is OK. */
export function validateRange(start: string, end: string): string | null {
  if (start && !isValidIsoDate(start)) {
    return 'Start date must be in YYYY-MM-DD format.';
  }
  if (end && !isValidIsoDate(end)) {
    return 'End date must be in YYYY-MM-DD format.';
  }
  if (start && end && start > end) {
    return 'Start date must be on or before end date.';
  }
  return null;
}

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
  startLabel?: string;
  endLabel?: string;
  testID?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  startLabel = 'Start date',
  endLabel = 'End date',
  testID = 'date-range-picker',
}: DateRangePickerProps): React.ReactElement {
  const error = validateRange(startDate, endDate);

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>{startLabel}</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={onChangeStart}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            testID={`${testID}-start`}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{endLabel}</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={onChangeEnd}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            testID={`${testID}-end`}
          />
        </View>
      </View>
      {error ? (
        <Text style={styles.error} testID={`${testID}-error`}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  error: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: 13,
  },
});

export default DateRangePicker;
