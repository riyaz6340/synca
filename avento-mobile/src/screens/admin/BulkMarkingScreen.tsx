/**
 * BulkMarkingScreen — the Admin fast bulk-attendance marking screen (task 11.2).
 *
 * This is the top-priority "fast attendance" workflow. The Admin loads a
 * group's active students, every student defaults to "Present", and the Admin
 * taps only the exceptions before submitting the whole class in a single API
 * call.
 *
 * Behaviour:
 *  - Loads active persons via {@link adminApi.getGroupMembers}
 *    (GET /api/groups/:id) and initialises ALL students to "Present" using the
 *    pure {@link initialMarkingState} helper (Requirement 10.3 / Property 6).
 *  - Tapping a student cycles their status Present → Absent → Late → On_Leave
 *    via {@link nextStatus} (Requirement 10.8); a {@link StatusBadge} shows the
 *    current status (Requirement 10.2).
 *  - A date input (defaulting to today) lets the Admin mark a different date
 *    (Requirement 10.9).
 *  - "Submit Attendance" builds the payload with {@link buildBulkPayload} (one
 *    record per student, valid statuses, correct group_id + date — Property 5 /
 *    Requirements 10.4, 10.5) and POSTs it via
 *    {@link adminApi.submitBulkAttendance} (Requirement 10.4). Up to 60 students
 *    are submitted in a single call (Requirement 10.5).
 *  - On success, a confirmation with the created-record count is shown and the
 *    screen navigates back to the group list (Requirement 10.6).
 *  - On failure, the marked state is RETAINED so the Admin can retry without
 *    re-marking (Requirement 10.7).
 *  - When the device is offline, the submission is enqueued on the offline
 *    queue (POST /api/attendance/bulk) and a pending indicator is shown
 *    (Requirement 21.2).
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 21.2
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '@/api/admin';
import {
  EmptyState,
  ErrorState,
  SkeletonLoader,
  StatusBadge,
  colors,
  radius,
  spacing,
} from '@/components';
import { useOfflineQueue } from '@/stores/offlineQueue';
import type { Person } from '@/types/models';
import type { AdminAttendanceStackParamList } from '@/types/navigation';
import {
  buildBulkPayload,
  initialMarkingState,
  nextStatus,
  todayIso,
  type MarkingState,
} from '@/utils/bulkAttendance';
import { ADMIN_GROUPS_QUERY_KEY } from './GroupListScreen';

type RouteProps = RouteProp<AdminAttendanceStackParamList, 'BulkMarking'>;

/** React Query key for a group's members. */
export const groupMembersQueryKey = (groupId: string) =>
  ['admin', 'group-members', groupId] as const;

export default function BulkMarkingScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();
  const enqueue = useOfflineQueue((s) => s.enqueue);

  const { groupId, groupName } = route.params;

  const [date, setDate] = useState<string>(todayIso);
  const [marking, setMarking] = useState<MarkingState>({});
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: groupMembersQueryKey(groupId),
    queryFn: () => adminApi.getGroupMembers(groupId),
  });

  // Default every loaded student to "Present" once members arrive (Req 10.3).
  useEffect(() => {
    if (data) {
      const active = data.filter((p: Person) => p.is_active !== false);
      setMarking(initialMarkingState(active));
    }
  }, [data]);

  const persons: Person[] = useMemo(
    () => (data ?? []).filter((p: Person) => p.is_active !== false),
    [data],
  );

  const mutation = useMutation({
    mutationFn: () => adminApi.submitBulkAttendance(buildBulkPayload(groupId, date, marking)),
    onSuccess: (result) => {
      setSuccessCount(result.count);
      void queryClient.invalidateQueries({ queryKey: ADMIN_GROUPS_QUERY_KEY });
    },
    // NOTE: deliberately no onError reset — the marked state is retained so the
    // Admin can retry without re-marking (Requirement 10.7).
  });

  const toggle = (personId: string): void => {
    setMarking((prev) => ({
      ...prev,
      [personId]: nextStatus(prev[personId] ?? 'Present'),
    }));
  };

  const onSubmit = async (): Promise<void> => {
    const state = await NetInfo.fetch().catch(() => null);
    const offline =
      state != null &&
      !(Boolean(state.isConnected) && state.isInternetReachable !== false);

    if (offline) {
      // Offline: enqueue the bulk submission for replay on reconnect (Req 21.2).
      enqueue({
        method: 'POST',
        url: '/api/attendance/bulk',
        body: buildBulkPayload(groupId, date, marking),
        maxRetries: 3,
      });
      setQueuedOffline(true);
      return;
    }

    mutation.mutate();
  };

  // ── Success confirmation (Requirement 10.6) ────────────────────────────────
  if (successCount !== null) {
    return (
      <View style={styles.centered} testID="bulk-marking-success">
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Attendance submitted</Text>
        <Text style={styles.successMessage} testID="bulk-marking-success-count">
          {successCount} {successCount === 1 ? 'record' : 'records'} saved for {groupName}.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => navigation.goBack()}
          testID="bulk-marking-success-done"
        >
          <Text style={styles.buttonText}>Back to groups</Text>
        </Pressable>
      </View>
    );
  }

  // ── Offline-queued confirmation (Requirement 21.2) ─────────────────────────
  if (queuedOffline) {
    return (
      <View style={styles.centered} testID="bulk-marking-queued">
        <Text style={styles.successIcon}>📡</Text>
        <Text style={styles.successTitle}>Saved offline</Text>
        <Text style={styles.successMessage}>
          You're offline. {groupName}'s attendance is queued and will sync
          automatically when you're back online.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => navigation.goBack()}
          testID="bulk-marking-queued-done"
        >
          <Text style={styles.buttonText}>Back to groups</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return <SkeletonLoader testID="bulk-marking-skeleton" />;
  }

  if (isError && !data) {
    return (
      <ErrorState
        testID="bulk-marking-error"
        title="Couldn't load students"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <View style={styles.container} testID="bulk-marking-screen">
      <View style={styles.header}>
        <Text style={styles.groupName} numberOfLines={1}>
          {groupName}
        </Text>
        <View style={styles.dateField}>
          <Text style={styles.dateLabel}>Date</Text>
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            testID="bulk-marking-date"
          />
        </View>
      </View>

      <FlatList
        testID="bulk-marking-list"
        data={persons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          persons.length === 0 ? styles.emptyContent : styles.listContent
        }
        renderItem={({ item }) => {
          const status = marking[item.id] ?? 'Present';
          return (
            <Pressable
              accessibilityRole="button"
              testID={`bulk-student-${item.id}`}
              style={styles.row}
              onPress={() => toggle(item.id)}
            >
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.roll_number ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    Roll {item.roll_number}
                  </Text>
                ) : null}
              </View>
              <StatusBadge status={status} testID={`bulk-student-status-${item.id}`} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            testID="bulk-marking-empty"
            icon="🧑‍🎓"
            title="No active students"
            message="This group has no active students to mark."
          />
        }
      />

      {mutation.isError ? (
        <Text style={styles.error} testID="bulk-marking-submit-error">
          Couldn't submit attendance. Your marks are kept — please try again.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: mutation.isPending || persons.length === 0 }}
        style={[
          styles.button,
          (mutation.isPending || persons.length === 0) && styles.buttonDisabled,
        ]}
        disabled={mutation.isPending || persons.length === 0}
        onPress={() => {
          void onSubmit();
        }}
        testID="bulk-marking-submit"
      >
        {mutation.isPending ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Submit Attendance</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginRight: spacing.md,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
  },
  emptyContent: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    margin: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
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
