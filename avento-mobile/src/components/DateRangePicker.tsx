/**
 * DateRangePicker — a start/end date selection control using native date pickers.
 *
 * Uses @react-native-community/datetimepicker to show a native Android/iOS
 * date picker when the user taps each date field. The component still exposes
 * string values (YYYY-MM-DD) via onChangeStart/onChangeEnd for backward
 * compatibility with all consuming screens.
 */
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

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

/** Format a Date to YYYY-MM-DD in local time. */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD to a Date (midnight local time). */
function parseIsoDate(value: string): Date {
  if (isValidIsoDate(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
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
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const error = validateRange(startDate, endDate);

  const handleStartChange = (_event: DateTimePickerEvent, date?: Date): void => {
    setShowStart(Platform.OS === 'ios');
    if (date) {
      onChangeStart(toIsoDate(date));
    }
  };

  const handleEndChange = (_event: DateTimePickerEvent, date?: Date): void => {
    setShowEnd(Platform.OS === 'ios');
    if (date) {
      onChangeEnd(toIsoDate(date));
    }
  };

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>{startLabel}</Text>
          <Pressable
            style={styles.input}
            onPress={() => setShowStart(true)}
            testID={`${testID}-start`}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.inputText,
                !startDate && styles.placeholder,
              ]}
            >
              {startDate || 'Select date'}
            </Text>
          </Pressable>
          {showStart && (
            <DateTimePicker
              testID={`${testID}-start-picker`}
              value={parseIsoDate(startDate)}
              mode="date"
              display="default"
              onChange={handleStartChange}
            />
          )}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{endLabel}</Text>
          <Pressable
            style={styles.input}
            onPress={() => setShowEnd(true)}
            testID={`${testID}-end`}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.inputText,
                !endDate && styles.placeholder,
              ]}
            >
              {endDate || 'Select date'}
            </Text>
          </Pressable>
          {showEnd && (
            <DateTimePicker
              testID={`${testID}-end-picker`}
              value={parseIsoDate(endDate)}
              mode="date"
              display="default"
              onChange={handleEndChange}
            />
          )}
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
    backgroundColor: colors.background,
    justifyContent: 'center',
    minHeight: 44,
  },
  inputText: {
    fontSize: 15,
    color: colors.text,
  },
  placeholder: {
    color: colors.textMuted,
  },
  error: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: 13,
  },
});

export default DateRangePicker;
