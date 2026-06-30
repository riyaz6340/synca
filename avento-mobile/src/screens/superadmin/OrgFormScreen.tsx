/**
 * OrgFormScreen — the SuperAdmin organization create / edit screen (task 14.2).
 *
 * Drives two flows from the single `OrgForm` route:
 *  - CREATE (no `orgId`): a blank onboarding form. On submit it POSTs to
 *    `/api/super-admin/organizations` via {@link superAdminApi.createOrganization}
 *    with the new organization's details plus the first admin user's email and
 *    password (Requirements 19.2, 19.3).
 *  - EDIT (with `orgId`): the form is prefilled from the existing organization
 *    record (looked up in the list). On submit it PUTs to
 *    `/api/super-admin/organizations/:id` via {@link superAdminApi.updateOrganization}
 *    with the full set of editable fields (Requirement 19.5).
 *
 * Create fields: name, industry module, plan, admin email, admin password.
 * Edit fields: name, industry module, plan, monthly amount, billing status.
 *
 * On any successful create / update the organizations list query (and, in edit
 * mode, the org's detail query) is invalidated so the UI reflects the change,
 * and the screen navigates back.
 *
 * Validates: Requirements 19.2, 19.3, 19.5
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

import {
  superAdminApi,
  type CreateOrganizationInput,
  type CreateOrganizationResult,
  type OrganizationSummary,
  type UpdateOrganizationInput,
} from '@/api/superadmin';
import {
  ErrorState,
  SearchableDropdown,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import type { SuperAdminOrganizationsStackParamList } from '@/types/navigation';

type RouteProps = RouteProp<SuperAdminOrganizationsStackParamList, 'OrgForm'>;

/** Selectable plan options. */
export const PLAN_OPTIONS = ['free', 'basic', 'premium', 'enterprise'] as const;

/** Selectable billing-status options. */
export const BILLING_STATUS_OPTIONS = [
  'active',
  'trial',
  'suspended',
  'cancelled',
] as const;

/** A simple `{ value }` wrapper so the generic dropdown has an object to map. */
interface Option {
  value: string;
}

const toOptions = (values: readonly string[]): Option[] =>
  values.map((value) => ({ value }));

/** Local mutable form state — every field is a string for the text inputs. */
interface FormState {
  name: string;
  industry_module: string;
  plan: string;
  admin_email: string;
  admin_password: string;
  monthly_amount: string;
  billing_status: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  industry_module: '',
  plan: '',
  admin_email: '',
  admin_password: '',
  monthly_amount: '',
  billing_status: '',
};

function toFormState(org: OrganizationSummary): FormState {
  return {
    name: org.name ?? '',
    industry_module: org.industry_module ?? '',
    plan: org.plan ?? '',
    admin_email: '',
    admin_password: '',
    monthly_amount:
      org.monthly_amount != null ? String(org.monthly_amount) : '',
    billing_status: org.billing_status ?? '',
  };
}

/** Build the create payload (Requirement 19.3). */
export function buildCreateInput(form: FormState): CreateOrganizationInput {
  const trimmed = (v: string): string | undefined => {
    const t = v.trim();
    return t ? t : undefined;
  };
  return {
    name: form.name.trim(),
    industry_module: trimmed(form.industry_module),
    plan: trimmed(form.plan),
    admin_email: form.admin_email.trim(),
    admin_password: form.admin_password,
  };
}

/** Build the full update payload (Requirement 19.5). */
export function buildUpdateInput(form: FormState): UpdateOrganizationInput {
  const trimmed = (v: string): string | undefined => {
    const t = v.trim();
    return t ? t : undefined;
  };
  const amount = form.monthly_amount.trim();
  const parsedAmount = amount ? Number(amount) : undefined;
  return {
    name: form.name.trim(),
    industry_module: trimmed(form.industry_module),
    plan: trimmed(form.plan),
    monthly_amount:
      parsedAmount != null && !Number.isNaN(parsedAmount) ? parsedAmount : undefined,
    billing_status: trimmed(form.billing_status),
  };
}

export default function OrgFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();

  const orgId = route.params?.orgId;
  const isEdit = Boolean(orgId);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ── Existing record for edit mode (prefilled from the list) ────────────────
  const {
    data: orgsPage,
    isLoading: isLoadingOrg,
    isError: isOrgError,
    refetch: refetchOrg,
  } = useQuery({
    queryKey: ['superadmin', 'organizations', 'all'],
    queryFn: () => superAdminApi.getOrganizations({ page: 1, limit: 200 }),
    enabled: isEdit,
  });

  const existing: OrganizationSummary | null = useMemo(() => {
    if (!isEdit) return null;
    return orgsPage?.data.find((o: OrganizationSummary) => o.id === orgId) ?? null;
  }, [isEdit, orgsPage, orgId]);

  // Prefill the form once the existing record is available.
  useEffect(() => {
    if (existing) {
      setForm(toFormState(existing));
    }
  }, [existing]);

  const selectedPlan = useMemo<Option | null>(
    () => (form.plan ? { value: form.plan } : null),
    [form.plan],
  );
  const selectedBilling = useMemo<Option | null>(
    () => (form.billing_status ? { value: form.billing_status } : null),
    [form.billing_status],
  );

  const setField = (key: keyof FormState, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['superadmin', 'organizations'] });
    if (orgId) {
      void queryClient.invalidateQueries({
        queryKey: ['superadmin', 'organization', orgId],
      });
    }
  };

  const saveMutation = useMutation<
    CreateOrganizationResult | OrganizationSummary,
    Error,
    void
  >({
    mutationFn: () =>
      isEdit && orgId
        ? superAdminApi.updateOrganization(orgId, buildUpdateInput(form))
        : superAdminApi.createOrganization(buildCreateInput(form)),
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
  });

  const validate = (): boolean => {
    let valid = true;

    if (!form.name.trim()) {
      setNameError('Name is required.');
      valid = false;
    } else {
      setNameError(null);
    }

    if (!isEdit) {
      if (!form.admin_email.trim()) {
        setEmailError('Admin email is required.');
        valid = false;
      } else {
        setEmailError(null);
      }
      if (!form.admin_password) {
        setPasswordError('Admin password is required.');
        valid = false;
      } else {
        setPasswordError(null);
      }
    } else {
      setEmailError(null);
      setPasswordError(null);
    }

    return valid;
  };

  const onSubmit = (): void => {
    if (!validate()) return;
    saveMutation.mutate();
  };

  // ── Loading / error for edit prefill ───────────────────────────────────────
  if (isEdit && isLoadingOrg) {
    return <SkeletonLoader testID="org-form-skeleton" />;
  }

  if (isEdit && isOrgError && !orgsPage) {
    return (
      <ErrorState
        testID="org-form-error"
        title="Couldn't load organization"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetchOrg();
        }}
      />
    );
  }

  const busy = saveMutation.isPending;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="org-form"
    >
      <Field label="Organization name" required>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(v) => setField('name', v)}
          placeholder="e.g. Springfield Elementary"
          placeholderTextColor={colors.textMuted}
          testID="org-name"
        />
        {nameError ? (
          <Text style={styles.error} testID="org-error-name">
            {nameError}
          </Text>
        ) : null}
      </Field>

      <Field label="Industry module">
        <TextInput
          style={styles.input}
          value={form.industry_module}
          onChangeText={(v) => setField('industry_module', v)}
          placeholder="e.g. education"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          testID="org-industry-module"
        />
      </Field>

      <Field label="Plan">
        <SearchableDropdown<Option>
          items={toOptions(PLAN_OPTIONS)}
          getLabel={(o) => o.value}
          getKey={(o) => o.value}
          selected={selectedPlan}
          onSelect={(o) => setField('plan', o.value)}
          placeholder="Select a plan"
          searchPlaceholder="Search plans…"
          emptyText="No plans found"
          testID="org-plan"
        />
      </Field>

      {/* ── Create-only: first admin user credentials (Requirement 19.3) ───── */}
      {!isEdit ? (
        <>
          <Field label="Admin email" required>
            <TextInput
              style={styles.input}
              value={form.admin_email}
              onChangeText={(v) => setField('admin_email', v)}
              placeholder="admin@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="org-admin-email"
            />
            {emailError ? (
              <Text style={styles.error} testID="org-error-email">
                {emailError}
              </Text>
            ) : null}
          </Field>

          <Field label="Admin password" required>
            <TextInput
              style={styles.input}
              value={form.admin_password}
              onChangeText={(v) => setField('admin_password', v)}
              placeholder="Temporary password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              testID="org-admin-password"
            />
            {passwordError ? (
              <Text style={styles.error} testID="org-error-password">
                {passwordError}
              </Text>
            ) : null}
          </Field>
        </>
      ) : null}

      {/* ── Edit-only: billing fields (Requirement 19.5) ───────────────────── */}
      {isEdit ? (
        <>
          <Field label="Monthly amount">
            <TextInput
              style={styles.input}
              value={form.monthly_amount}
              onChangeText={(v) => setField('monthly_amount', v)}
              placeholder="e.g. 99"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              testID="org-monthly-amount"
            />
          </Field>

          <Field label="Billing status">
            <SearchableDropdown<Option>
              items={toOptions(BILLING_STATUS_OPTIONS)}
              getLabel={(o) => o.value}
              getKey={(o) => o.value}
              selected={selectedBilling}
              onSelect={(o) => setField('billing_status', o.value)}
              placeholder="Select billing status"
              searchPlaceholder="Search statuses…"
              emptyText="No statuses found"
              testID="org-billing-status"
            />
          </Field>
        </>
      ) : null}

      {saveMutation.isError ? (
        <Text style={styles.error} testID="org-form-submit-error">
          Couldn't save the organization. Please try again.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={onSubmit}
        testID="org-submit"
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>
            {isEdit ? 'Save changes' : 'Create organization'}
          </Text>
        )}
      </Pressable>
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
});
