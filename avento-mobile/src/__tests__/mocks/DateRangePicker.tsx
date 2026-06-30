/**
 * Test mock for DateRangePicker that renders plain TextInputs so tests
 * can use fireEvent.changeText to set dates.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export function isValidIsoDate(value: string): boolean {
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function validateRange(start: string, end: string): string | null {
  if (start && !isValidIsoDate(start)) return 'Start date must be in YYYY-MM-DD format.';
  if (end && !isValidIsoDate(end)) return 'End date must be in YYYY-MM-DD format.';
  if (start && end && start > end) return 'Start date must be on or before end date.';
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
    <View testID={testID}>
      <View>
        <View>
          <Text>{startLabel}</Text>
          <TextInput
            value={startDate}
            onChangeText={onChangeStart}
            placeholder="YYYY-MM-DD"
            testID={`${testID}-start`}
          />
        </View>
        <View>
          <Text>{endLabel}</Text>
          <TextInput
            value={endDate}
            onChangeText={onChangeEnd}
            placeholder="YYYY-MM-DD"
            testID={`${testID}-end`}
          />
        </View>
      </View>
      {error ? <Text testID={`${testID}-error`}>{error}</Text> : null}
    </View>
  );
}

export default DateRangePicker;
