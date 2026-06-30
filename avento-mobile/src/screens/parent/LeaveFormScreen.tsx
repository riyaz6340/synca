/**
 * LeaveFormScreen — the Parent's "New Leave Request" form (task 9.6).
 *
 * Collects child selection, start/end dates, reason and an optional leave type,
 * then submits to the backend via `portalApi.submitLeaveRequest`
 * (POST /api/leave-requests) using a React Query mutation (Requirement 6.2,
 * 6.3).
 *
 * Client-side validation is delegated to the pure {@link validateLeaveRequest}
 * helper: the submission is blocked locally — with NO API call — whenever
 * `start_date > end_date` or any required field (person_id, start_date,
 * end_date, reason) is empty, and field-level errors are rendered
 * (Requirements 6.2, 6.4 / Property 9). On a successful submission a success
 * confirmation is shown and the leave-requests list query is invalidated
 * (Requirement 6.3).
 *
 * Children for the selector are loaded via `portalApi.getPersons`.
 *
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { portalApi, type LeaveSubmitInput } from '@/api/portal';
import { DateRangePicker } from '@/components/DateRangePicker';
import { SearchableDropdown } from '@/components/SearchableDropdown';
import { colors, radius, spacing } from '@/components/theme';
import {
  validateLeaveRequest,
  type LeaveValidationField,
} from '@/utils/leaveValidation';
import type { ParentLeaveStackParamList } from '@/types/navigation';
import type { PersonWithStatus } from '@/types/models';

type RouteProps = RouteProp<ParentLeaveStackParamList, 'LeaveForm'>;

export default function LeaveFormScreen(): React.ReactElement {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();

  const presetPersonId = route.params?.personId;

  const { data: persons = [] } = useQuery({
    queryKey: ['portal-persons'],
    queryFn: () => portalApi.getPersons(),
  });

  const [personId, setPersonId] = useState<string>(presetPersonId ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [errors, setErrors] = useState<
    Partial<Record<LeaveValidationField, string>>
  >({});
  const [submitted, setSubmitted] = useState(false);

  const selectedPerson = useMemo(
    () => persons.find((p: PersonWithStatus) => p.id === personId) ?? null,
    [persons, personId]
  );

  const mutation = useMutation({
    mutationFn: (input: LeaveSubmitInput) => portalApi.submitLeaveRequest(input),
    onSuccess: () => {
      setSubmitted(true);
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    },
  });

  const onSubmit = (): void => {
    const input = {
      person_id: personId,
      start_date: startDate,
      end_date: endDate,
      reason,
      leave_type: leaveType,
    };

    const result = validateLeaveRequest(input);
    if (!result.valid) {
      // Reject locally and surface field-level errors. No API call is made.
      setErrors(result.errors);
      return;
    }

    setErrors({});
    mutation.mutate({
      person_id: personId.trim(),
      start_date: startDate.trim(),
      end_date: endDate.trim(),
      reason: reason.trim(),
      ...(leaveType.trim() ? { leave_type: leaveType.trim() } : {}),
    });
  };

  if (submitted) {
    return (
      <View style={styles.successContainer} testID="leave-form-success">
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Leave request submitted</Text>
        <Text style={styles.successMessage}>
          Your leave request has been sent to the school for approval.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          testID="leave-form-success-done"
        >
          <Text style={styles.buttonText}>Back to requests</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="leave-form"
    >
      <View style={styles.field}>
        <Text style={styles.label}>Child</Text>
        <SearchableDropdown<PersonWithStatus>
          items={persons}
          getLabel={(p) => p.name}
          getKey={(p) => p.id}
          selected={selectedPerson}
          onSelect={(p) => setPersonId(p.id)}
          placeholder="Select child"
          searchPlaceholder="Search children…"
          emptyText="No children found"
          testID="leave-person-dropdown"
        />
        {errors.person_id ? (
          <Text style={styles.error} testID="leave-error-person_id">
            {errors.person_id}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Dates</Text>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChangeStart={setStartDate}
          onChangeEnd={setEndDate}
          testID="leave-date-range"
        />
        {errors.start_date ? (
          <Text style={styles.error} testID="leave-error-start_date">
            {errors.start_date}
          </Text>
        ) : null}
        {errors.end_date ? (
          <Text style={styles.error} testID="leave-error-end_date">
            {errors.end_date}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Reason</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={reason}
          onChangeText={setReason}
          placeholder="Reason for leave"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          testID="leave-reason"
        />
        {errors.reason ? (
          <Text style={styles.error} testID="leave-error-reason">
            {errors.reason}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Leave type (optional)</Text>
        <TextInput
          style={styles.input}
          value={leaveType}
          onChangeText={setLeaveType}
          placeholder="e.g. Sick, Vacation"
          placeholderTextColor={colors.textMuted}
          testID="leave-type"
        />
      </View>

      {mutation.isError ? (
        <Text style={styles.error} testID="leave-submit-error">
          Could not submit your request. Please try again.
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.button, mutation.isPending && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={mutation.isPending}
        accessibilityRole="button"
        accessibilityState={{ disabled: mutation.isPending }}
        testID="leave-submit"
      >
        {mutation.isPending ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Submit Request</Text>
        )}
      </TouchableOpacity>
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
    minHeight: 80,
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
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
