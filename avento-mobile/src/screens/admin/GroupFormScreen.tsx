/**
 * GroupFormScreen — Admin group create / detail / edit screen (task 12.2).
 *
 * Serves two modes driven by the `groupId` route param:
 *
 *  - **Create** (no `groupId`): shows name + description fields and a "Create
 *    Group" button that POSTs via {@link adminApi.createGroup}
 *    (POST /api/groups) — Requirements 12.2, 12.3.
 *
 *  - **Detail + edit** (with `groupId`): loads the group's detail and members
 *    via {@link adminApi.getGroup} (GET /api/groups/:id), lets the Admin edit
 *    name/description (PUT /api/groups/:id) and shows the member list
 *    (Requirement 12.4). Members can be added via a searchable dropdown of the
 *    organization's persons (POST /api/groups/:id/members) and removed
 *    individually (DELETE /api/groups/:id/members/:personId) — Requirement 12.5.
 *
 * All mutations invalidate the relevant React Query caches (the groups list and
 * the group detail) so the UI reflects server state.
 *
 * Validates: Requirements 12.2, 12.3, 12.4, 12.5
 */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '@/api/admin';
import {
  EmptyState,
  ErrorState,
  SearchableDropdown,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import type { Person } from '@/types/models';
import type { AdminManagementStackParamList } from '@/types/navigation';

import { GROUPS_QUERY_KEY } from './GroupsScreen';

type RouteProps = RouteProp<AdminManagementStackParamList, 'GroupForm'>;

/** React Query key for a single group's detail. */
export const groupDetailQueryKey = (groupId: string) =>
  ['admin', 'group', groupId] as const;

export default function GroupFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();

  const groupId = route.params?.groupId;
  const isEdit = Boolean(groupId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  // ── Group detail (edit mode only) ──────────────────────────────────────────
  const detail = useQuery({
    queryKey: groupDetailQueryKey(groupId ?? ''),
    queryFn: () => adminApi.getGroup(groupId as string),
    enabled: isEdit,
  });

  // Prefill the editable fields once the detail arrives.
  const loadedId = detail.data?.id;
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (isEdit && loadedId && prefilledFor !== loadedId) {
    setName(detail.data?.name ?? '');
    setDescription(detail.data?.description ?? '');
    setPrefilledFor(loadedId);
  }

  // ── Persons available to add (edit mode only) ───────────────────────────────
  const personsQuery = useQuery({
    queryKey: ['admin', 'persons', 'all'],
    queryFn: () => adminApi.getPersons({ page: 1, limit: 100 }),
    enabled: isEdit,
  });

  const members = detail.data?.members ?? [];
  const memberIds = useMemo(() => new Set(members.map((m: Person) => m.id)), [members]);
  const addablePersons = useMemo(
    () => (personsQuery.data?.data ?? []).filter((p: Person) => !memberIds.has(p.id)),
    [personsQuery.data, memberIds],
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY });
  const invalidateDetail = () =>
    groupId &&
    queryClient.invalidateQueries({ queryKey: groupDetailQueryKey(groupId) });

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createGroup({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      void invalidateList();
      navigation.goBack();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      adminApi.updateGroup(groupId as string, {
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      void invalidateList();
      void invalidateDetail();
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (personId: string) =>
      adminApi.addGroupMembers(groupId as string, [personId]),
    onSuccess: () => {
      setSelectedPerson(null);
      void invalidateList();
      void invalidateDetail();
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (personId: string) =>
      adminApi.removeGroupMember(groupId as string, personId),
    onSuccess: () => {
      void invalidateList();
      void invalidateDetail();
    },
  });

  const validateName = (): boolean => {
    if (!name.trim()) {
      setNameError('Group name is required.');
      return false;
    }
    setNameError(null);
    return true;
  };

  const onSubmit = (): void => {
    if (!validateName()) return;
    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  // ── Loading / error for edit-mode detail ────────────────────────────────────
  if (isEdit && detail.isLoading) {
    return <SkeletonLoader testID="group-form-skeleton" />;
  }

  if (isEdit && detail.isError && !detail.data) {
    return (
      <ErrorState
        testID="group-form-error"
        title="Couldn't load group"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void detail.refetch();
        }}
      />
    );
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="group-form"
    >
      <View style={styles.field}>
        <Text style={styles.label}>Group name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Class 1A"
          placeholderTextColor={colors.textMuted}
          testID="group-name-input"
        />
        {nameError ? (
          <Text style={styles.error} testID="group-name-error">
            {nameError}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="What is this group for?"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          testID="group-description-input"
        />
      </View>

      {createMutation.isError || updateMutation.isError ? (
        <Text style={styles.error} testID="group-form-submit-error">
          Could not save the group. Please try again.
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        testID="group-submit"
      >
        {saving ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>{isEdit ? 'Save Changes' : 'Create Group'}</Text>
        )}
      </Pressable>

      {isEdit ? (
        <View style={styles.membersSection} testID="group-members-section">
          <Text style={styles.sectionTitle}>Members</Text>

          <View style={styles.addRow}>
            <View style={styles.addDropdown}>
              <SearchableDropdown<Person>
                items={addablePersons}
                getLabel={(p) => p.name}
                getKey={(p) => p.id}
                selected={selectedPerson}
                onSelect={setSelectedPerson}
                placeholder="Select a person to add"
                searchPlaceholder="Search people…"
                emptyText="No people available"
                testID="group-add-member-dropdown"
              />
            </View>
            <Pressable
              style={[
                styles.addMemberButton,
                (!selectedPerson || addMemberMutation.isPending) &&
                  styles.buttonDisabled,
              ]}
              disabled={!selectedPerson || addMemberMutation.isPending}
              accessibilityRole="button"
              accessibilityState={{
                disabled: !selectedPerson || addMemberMutation.isPending,
              }}
              testID="group-add-member-button"
              onPress={() => {
                if (selectedPerson) addMemberMutation.mutate(selectedPerson.id);
              }}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>

          {addMemberMutation.isError || removeMemberMutation.isError ? (
            <Text style={styles.error} testID="group-member-error">
              Could not update members. Please try again.
            </Text>
          ) : null}

          <FlatList
            testID="group-members-list"
            data={members}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.memberRow} testID={`group-member-${item.id}`}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  testID={`group-remove-member-${item.id}`}
                  disabled={removeMemberMutation.isPending}
                  style={styles.removeButton}
                  onPress={() => removeMemberMutation.mutate(item.id)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <EmptyState
                testID="group-members-empty"
                icon="👥"
                message="No members yet. Add people to this group."
              />
            }
          />
        </View>
      ) : null}
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
  membersSection: {
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  addDropdown: {
    flex: 1,
    marginRight: spacing.sm,
  },
  addMemberButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  memberName: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    marginRight: spacing.md,
  },
  removeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSurface,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
