/**
 * HolidayFormScreen — the Admin "Add Holiday" form (task 12.6).
 *
 * Collects a date (YYYY-MM-DD), a name, and an optional description, then
 * submits via {@link adminApi.createHoliday} (POST /api/holidays) using a
 * React Query mutation (Requirements 16.2, 16.3). On success the holidays list
 * query is invalidated so the new item appears, and the screen navigates back.
 *
 * Validation: date and name are required, and the date must be a valid
 * YYYY-MM-DD value. Submission is blocked locally with field-level errors and
 * no API call is made when validation fails.
 *
 * Validates: Requirements 16.2, 16.3
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi, type HolidayInput } from '@/api/admin';
import { colors, radius, spacing } from '@/components';
import { ADMIN_HOLIDAYS_QUERY_KEY } from './HolidaysScreen';

/** Strict YYYY-MM-DD shape check; the Date parse below validates the value. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` is a well-formed, real YYYY-MM-DD calendar date. */
export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  // Guard against roll-over (e.g. 2024-02-31 → March): re-render must match.
  const [year, month, day] = value.split('-').map((part: string) => Number(part));
  return (
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  );
}

interface FormErrors {
  date?: string;
  name?: string;
}

export default function HolidayFormScreen(): React.ReactElement {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const mutation = useMutation({
    mutationFn: (input: HolidayInput) => adminApi.createHoliday(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_HOLIDAYS_QUERY_KEY });
      navigation.goBack();
    },
  });

  const validate = (): boolean => {
    const next: FormErrors = {};
    const trimmedDate = date.trim();
    if (!trimmedDate) {
      next.date = 'Date is required.';
    } else if (!isValidDate(trimmedDate)) {
      next.date = 'Enter a valid date in YYYY-MM-DD format.';
    }
    if (!name.trim()) {
      next.name = 'Name is required.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (): void => {
    if (!validate()) {
      return;
    }
    const input: HolidayInput = {
      date: date.trim(),
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    mutation.mutate(input);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="holiday-form"
    >
      <View style={styles.field}>
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          testID="holiday-date"
        />
        {errors.date ? (
          <Text style={styles.error} testID="holiday-error-date">
            {errors.date}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Independence Day"
          placeholderTextColor={colors.textMuted}
          testID="holiday-name"
        />
        {errors.name ? (
          <Text style={styles.error} testID="holiday-error-name">
            {errors.name}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional details about this holiday"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          testID="holiday-description"
        />
      </View>

      {mutation.isError ? (
        <Text style={styles.error} testID="holiday-submit-error">
          Could not save the holiday. Please try again.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: mutation.isPending }}
        style={[styles.button, mutation.isPending && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={mutation.isPending}
        testID="holiday-submit"
      >
        {mutation.isPending ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Save Holiday</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    marginTop: spacing.sm,
    fontSize: 13,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});
