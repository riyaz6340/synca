/**
 * StudentFormScreen — the Admin student create / edit / detail screen (task 12.1).
 *
 * Drives three closely-related flows from the single `StudentForm` route:
 *  - CREATE (no `personId`): a blank form. On submit it POSTs to
 *    `/api/persons` via {@link adminApi.createPerson} (Requirement 11.3).
 *  - EDIT (with `personId`): the form is prefilled from the existing record.
 *    On submit it PUTs to `/api/persons/:id` via {@link adminApi.updatePerson}
 *    (Requirement 11.5).
 *  - DETAIL (edit mode header): shows the student's associated group and a
 *    derived parent-account status, plus a "Deactivate" action that PATCHes
 *    `/api/persons/:id/deactivate` via {@link adminApi.deactivatePerson}
 *    (Requirements 11.4, 11.6).
 *
 * Form fields: name, roll number, admission number, parent mobile, parent
 * email, gender, date of birth, guardian name, and group assignment (via a
 * {@link SearchableDropdown} over {@link adminApi.getGroups}) — Requirement 11.2.
 *
 * On any successful create / update / deactivate the persons list query is
 * invalidated so the roster reflects the change (Requirements 11.3, 11.5, 11.6)
 * and the screen navigates back.
 *
 * Parent-account status note: the backend `Person` model exposes no explicit
 * "parent account linked" flag, so this screen derives a simple Linked /
 * Not linked indicator from the presence of `parent_email`.
 *
 * Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi, type PersonInput } from '@/api/admin';
import {
  ErrorState,
  SearchableDropdown,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import type { Group, Person } from '@/types/models';
import type { AdminManagementStackParamList } from '@/types/navigation';

type RouteProps = RouteProp<AdminManagementStackParamList, 'StudentForm'>;

/** Local mutable form state — every field is a string for the text inputs. */
interface FormState {
  name: string;
  roll_number: string;
  admission_number: string;
  parent_mobile: string;
  parent_email: string;
  gender: string;
  date_of_birth: string;
  guardian_name: string;
  group_id: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  roll_number: '',
  admission_number: '',
  parent_mobile: '',
  parent_email: '',
  gender: '',
  date_of_birth: '',
  guardian_name: '',
  group_id: '',
};

/** Build the API payload, omitting blank optional fields. */
export function buildPersonInput(form: FormState): PersonInput {
  const trimmed = (v: string): string | undefined => {
    const t = v.trim();
    return t ? t : undefined;
  };
  return {
    name: form.name.trim(),
    roll_number: trimmed(form.roll_number),
    admission_number: trimmed(form.admission_number),
    parent_mobile: trimmed(form.parent_mobile),
    parent_email: trimmed(form.parent_email),
    gender: trimmed(form.gender),
    date_of_birth: trimmed(form.date_of_birth),
    guardian_name: trimmed(form.guardian_name),
    group_id: trimmed(form.group_id),
  };
}

function toFormState(person: Person): FormState {
  return {
    name: person.name ?? '',
    roll_number: person.roll_number ?? '',
    admission_number: person.admission_number ?? '',
    parent_mobile: person.parent_mobile ?? '',
    parent_email: person.parent_email ?? '',
    gender: person.gender ?? '',
    date_of_birth: person.date_of_birth ?? '',
    guardian_name: person.guardian_name ?? '',
    group_id: person.group_id ?? '',
  };
}

export default function StudentFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();

  const personId = route.params?.personId;
  const isEdit = Boolean(personId);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [guardianNameError, setGuardianNameError] = useState<string | null>(null);

  // ── Group options for the assignment dropdown (Requirement 11.2) ───────────
  const { data: groups = [] } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: adminApi.getGroups,
  });

  // ── Existing record for edit/detail mode ───────────────────────────────────
  const {
    data: personsPage,
    isLoading: isLoadingPerson,
    isError: isPersonError,
    refetch: refetchPerson,
  } = useQuery({
    queryKey: ['admin', 'person', personId],
    queryFn: () => adminApi.getPersons({ page: 1, limit: 200 }),
    enabled: isEdit,
  });

  const existing: Person | null = useMemo(() => {
    if (!isEdit) return null;
    return personsPage?.data.find((p: Person) => p.id === personId) ?? null;
  }, [isEdit, personsPage, personId]);

  // Prefill the form once the existing record is available.
  useEffect(() => {
    if (existing) {
      setForm(toFormState(existing));
    }
  }, [existing]);

  const selectedGroup = useMemo(
    () => groups.find((g: Group) => g.id === form.group_id) ?? null,
    [groups, form.group_id],
  );

  const setField = (key: keyof FormState, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const invalidateList = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'persons'] });
  };

  const saveMutation = useMutation({
    mutationFn: (input: PersonInput) =>
      isEdit && personId
        ? adminApi.updatePerson(personId, input)
        : adminApi.createPerson(input),
    onSuccess: () => {
      invalidateList();
      navigation.goBack();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => adminApi.deactivatePerson(personId as string),
    onSuccess: () => {
      invalidateList();
      navigation.goBack();
    },
  });

  const onSubmit = (): void => {
    let hasError = false;

    if (!form.name.trim()) {
      setNameError('Name is required.');
      hasError = true;
    } else {
      setNameError(null);
    }

    if (!form.guardian_name.trim()) {
      setGuardianNameError('Guardian name is required.');
      hasError = true;
    } else {
      setGuardianNameError(null);
    }

    if (hasError) return;

    saveMutation.mutate(buildPersonInput(form));
  };

  // ── Loading / error for edit prefill ───────────────────────────────────────
  if (isEdit && isLoadingPerson) {
    return <SkeletonLoader testID="student-form-skeleton" />;
  }

  if (isEdit && isPersonError && !personsPage) {
    return (
      <ErrorState
        testID="student-form-error"
        title="Couldn't load student"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetchPerson();
        }}
      />
    );
  }

  const parentLinked = Boolean(form.parent_email.trim());
  const busy = saveMutation.isPending || deactivateMutation.isPending;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="student-form"
    >
      {/* ── Detail header (edit mode only) ─────────────────────────────────── */}
      {isEdit && existing ? (
        <View style={styles.detailCard} testID="student-detail">
          <Text style={styles.detailName}>{existing.name}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Group</Text>
            <Text style={styles.detailValue} testID="student-detail-group">
              {existing.group_name ?? 'Unassigned'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Parent account</Text>
            <View
              style={[
                styles.statusPill,
                parentLinked ? styles.statusLinked : styles.statusUnlinked,
              ]}
              testID="student-detail-parent-status"
            >
              <Text
                style={[
                  styles.statusText,
                  parentLinked ? styles.statusTextLinked : styles.statusTextUnlinked,
                ]}
              >
                {parentLinked ? 'Linked' : 'Not linked'}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={styles.detailValue} testID="student-detail-active">
              {existing.is_active === false ? 'Inactive' : 'Active'}
            </Text>
          </View>
        </View>
      ) : null}

      <Field label="Name" required>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(v) => setField('name', v)}
          placeholder="Full name"
          placeholderTextColor={colors.textMuted}
          testID="student-name"
        />
        {nameError ? (
          <Text style={styles.error} testID="student-error-name">
            {nameError}
          </Text>
        ) : null}
      </Field>

      <Field label="Roll number">
        <TextInput
          style={styles.input}
          value={form.roll_number}
          onChangeText={(v) => setField('roll_number', v)}
          placeholder="e.g. 12"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          testID="student-roll-number"
        />
      </Field>

      <Field label="Admission number">
        <TextInput
          style={styles.input}
          value={form.admission_number}
          onChangeText={(v) => setField('admission_number', v)}
          placeholder="e.g. ADM-2024-001"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          testID="student-admission-number"
        />
      </Field>

      <Field label="Parent mobile">
        <TextInput
          style={styles.input}
          value={form.parent_mobile}
          onChangeText={(v) => setField('parent_mobile', v)}
          placeholder="e.g. +1 555 123 4567"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          testID="student-parent-mobile"
        />
      </Field>

      <Field label="Parent email">
        <TextInput
          style={styles.input}
          value={form.parent_email}
          onChangeText={(v) => setField('parent_email', v)}
          placeholder="parent@example.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          testID="student-parent-email"
        />
      </Field>

      <Field label="Gender">
        <TextInput
          style={styles.input}
          value={form.gender}
          onChangeText={(v) => setField('gender', v)}
          placeholder="e.g. Male / Female / Other"
          placeholderTextColor={colors.textMuted}
          testID="student-gender"
        />
      </Field>

      <Field label="Date of birth">
        <TextInput
          style={styles.input}
          value={form.date_of_birth}
          onChangeText={(v) => setField('date_of_birth', v)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          testID="student-date-of-birth"
        />
      </Field>

      <Field label="Guardian name" required>
        <TextInput
          style={styles.input}
          value={form.guardian_name}
          onChangeText={(v) => setField('guardian_name', v)}
          placeholder="Guardian / parent name"
          placeholderTextColor={colors.textMuted}
          testID="student-guardian-name"
        />
        {guardianNameError ? (
          <Text style={styles.error} testID="student-error-guardian-name">
            {guardianNameError}
          </Text>
        ) : null}
      </Field>

      <Field label="Group">
        <SearchableDropdown<Group>
          items={groups}
          getLabel={(g) => g.name}
          getKey={(g) => g.id}
          selected={selectedGroup}
          onSelect={(g) => setField('group_id', g.id)}
          placeholder="Assign to a group"
          searchPlaceholder="Search groups…"
          emptyText="No groups found"
          testID="student-group"
        />
      </Field>

      {saveMutation.isError ? (
        <Text style={styles.error} testID="student-form-submit-error">
          Couldn't save the student. Please try again.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={onSubmit}
        testID="student-submit"
      >
        {saveMutation.isPending ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>
            {isEdit ? 'Save changes' : 'Create student'}
          </Text>
        )}
      </Pressable>

      {/* ── Deactivate action (edit mode, active students) ─────────────────── */}
      {isEdit && existing && existing.is_active !== false ? (
        <>
          {deactivateMutation.isError ? (
            <Text style={styles.error} testID="student-deactivate-error">
              Couldn't deactivate the student. Please try again.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            style={[styles.deactivateButton, busy && styles.buttonDisabled]}
            disabled={busy}
            onPress={() => deactivateMutation.mutate()}
            testID="student-deactivate"
          >
            {deactivateMutation.isPending ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <Text style={styles.deactivateButtonText}>Deactivate student</Text>
            )}
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

/** Small labeled field wrapper to keep the form markup tidy. */
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      {children}
    </View>
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
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  statusLinked: {
    backgroundColor: colors.present,
  },
  statusUnlinked: {
    backgroundColor: colors.warningSurface,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextLinked: {
    color: colors.primaryText,
  },
  statusTextUnlinked: {
    color: colors.warningText,
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
  requiredMark: {
    color: colors.danger,
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
  deactivateButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  deactivateButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
