/**
 * AnnouncementFormScreen — the Admin "New Announcement" form (task 12.4).
 *
 * Collects a title, body, target type (Organization / Group / Person) and the
 * matching target selection, then submits via
 * {@link adminApi.createAnnouncement} (POST /api/announcements) using a React
 * Query mutation (Requirements 14.2, 14.4). When the Admin chooses to publish
 * immediately, {@link adminApi.publishAnnouncement} is called for the created
 * announcement (Requirement 14.4).
 *
 * Target selection:
 *  - Organization — targets the whole organization; no extra selection needed.
 *  - Group — renders a multi-select list of the org's groups, loaded via
 *    {@link adminApi.getGroups} (Requirement 14.3). The selected group ids are
 *    sent as `target_ids`.
 *  - Person — a target type is recorded; the body explains person-level
 *    targeting selection is configured elsewhere (the form keeps the picker
 *    scoped to groups per the spec).
 *
 * On success the announcements list query is invalidated so the new item shows
 * with its correct Draft/Published status, and the screen navigates back.
 *
 * Validates: Requirements 14.2, 14.3, 14.4
 */
import { useMemo, useState } from 'react';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi, type AnnouncementInput } from '@/api/admin';
import {
  ErrorState,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import type { Group } from '@/types/models';
import { ADMIN_ANNOUNCEMENTS_QUERY_KEY } from './AnnouncementsScreen';

/** React Query key for the groups list used by the Group target multi-select. */
export const ADMIN_GROUPS_QUERY_KEY = ['admin', 'groups'] as const;

type TargetType = AnnouncementInput['target_type'];

const TARGET_TYPES: TargetType[] = ['Organization', 'Group', 'Person'];

export default function AnnouncementFormScreen(): React.ReactElement {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('Organization');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [publishNow, setPublishNow] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    body?: string;
    target?: string;
  }>({});

  // Groups are only needed when targeting a Group; fetch lazily on demand.
  const {
    data: groups,
    isLoading: groupsLoading,
    isError: groupsError,
    refetch: refetchGroups,
  } = useQuery({
    queryKey: ADMIN_GROUPS_QUERY_KEY,
    queryFn: adminApi.getGroups,
    enabled: targetType === 'Group',
  });

  const mutation = useMutation({
    mutationFn: async (input: AnnouncementInput) => {
      const created = await adminApi.createAnnouncement(input);
      if (publishNow) {
        await adminApi.publishAnnouncement(created.id);
      }
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ADMIN_ANNOUNCEMENTS_QUERY_KEY,
      });
      navigation.goBack();
    },
  });

  const toggleGroup = (id: string): void => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!title.trim()) {
      next.title = 'Title is required.';
    }
    if (!body.trim()) {
      next.body = 'Body is required.';
    }
    if (targetType === 'Group' && selectedGroupIds.length === 0) {
      next.target = 'Select at least one group.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (): void => {
    if (!validate()) {
      return;
    }
    const input: AnnouncementInput = {
      title: title.trim(),
      body: body.trim(),
      target_type: targetType,
      ...(targetType === 'Group' ? { target_ids: selectedGroupIds } : {}),
    };
    mutation.mutate(input);
  };

  const groupList: Group[] = useMemo(() => groups ?? [], [groups]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="announcement-form"
    >
      <View style={styles.field}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Announcement title"
          placeholderTextColor={colors.textMuted}
          testID="announcement-title"
        />
        {errors.title ? (
          <Text style={styles.error} testID="announcement-error-title">
            {errors.title}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Body</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={body}
          onChangeText={setBody}
          placeholder="Write your announcement…"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          testID="announcement-body"
        />
        {errors.body ? (
          <Text style={styles.error} testID="announcement-error-body">
            {errors.body}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Target type</Text>
        <View style={styles.segment} testID="announcement-target-type">
          {TARGET_TYPES.map((type) => {
            const active = targetType === type;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`announcement-target-${type}`}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => {
                  setTargetType(type);
                  setErrors((prev) => ({ ...prev, target: undefined }));
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {targetType === 'Group' ? (
        <View style={styles.field}>
          <Text style={styles.label}>Select groups</Text>
          {groupsLoading ? (
            <SkeletonLoader count={3} testID="announcement-groups-skeleton" />
          ) : groupsError ? (
            <ErrorState
              testID="announcement-groups-error"
              title="Couldn't load groups"
              message="We couldn't load the group list. Please try again."
              onRetry={() => {
                void refetchGroups();
              }}
            />
          ) : (
            <View testID="announcement-group-list">
              {groupList.map((group) => {
                const checked = selectedGroupIds.includes(group.id);
                return (
                  <Pressable
                    key={group.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    testID={`announcement-group-${group.id}`}
                    style={styles.groupRow}
                    onPress={() => toggleGroup(group.id)}
                  >
                    <View
                      style={[styles.checkbox, checked && styles.checkboxChecked]}
                    >
                      {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.groupName}>{group.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {errors.target ? (
            <Text style={styles.error} testID="announcement-error-target">
              {errors.target}
            </Text>
          ) : null}
        </View>
      ) : null}

      {targetType === 'Person' ? (
        <Text style={styles.note} testID="announcement-person-note">
          This announcement will target individual people. Person selection is
          managed from the person's profile.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: publishNow }}
        testID="announcement-publish-toggle"
        style={styles.publishRow}
        onPress={() => setPublishNow((p) => !p)}
      >
        <View style={[styles.checkbox, publishNow && styles.checkboxChecked]}>
          {publishNow ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={styles.groupName}>Publish immediately</Text>
      </Pressable>

      {mutation.isError ? (
        <Text style={styles.error} testID="announcement-submit-error">
          Could not save the announcement. Please try again.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: mutation.isPending }}
        style={[styles.button, mutation.isPending && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={mutation.isPending}
        testID="announcement-submit"
      >
        {mutation.isPending ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>
            {publishNow ? 'Create & Publish' : 'Save Draft'}
          </Text>
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
  note: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  segmentItemActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.primaryText,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  publishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: colors.background,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  groupName: {
    fontSize: 15,
    color: colors.text,
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
