/**
 * LeaveListScreen — the Parent's list of submitted leave requests (task 9.6).
 *
 * Fetches existing requests from the backend via
 * `portalApi.getLeaveRequests` (GET /api/leave-requests) using React Query and
 * displays them grouped by status in the order Pending → Approved → Rejected
 * (Requirement 6.1). Each request shows its status badge, child name, date
 * range, reason, and any admin remarks (Requirement 6.5).
 *
 * Loading shows a skeleton, errors show a retryable error state, and an empty
 * list shows an empty state with a call-to-action to create a request. A
 * floating "New Leave Request" button navigates to the form.
 *
 * Validates: Requirements 6.1, 6.5
 */

import { useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { portalApi } from '@/api/portal';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, radius, spacing } from '@/components/theme';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import type { ParentLeaveStackParamList } from '@/types/navigation';
import type { LeaveRequest } from '@/types/models';

type LeaveStatus = LeaveRequest['status'];

/** Display order for the status groups (Pending first — Requirement 6.1). */
const STATUS_ORDER: LeaveStatus[] = ['Pending', 'Approved', 'Rejected'];

type NavProp = NativeStackNavigationProp<
  ParentLeaveStackParamList,
  'LeaveList'
>;

/** Group leave requests by status preserving the canonical group order. */
export function groupByStatus(
  requests: readonly LeaveRequest[]
): Array<{ status: LeaveStatus; items: LeaveRequest[] }> {
  return STATUS_ORDER.map((status) => ({
    status,
    items: requests.filter((r) => r.status === status),
  })).filter((group) => group.items.length > 0);
}

function LeaveCard({ request }: { request: LeaveRequest }): React.ReactElement {
  return (
    <View style={styles.card} testID={`leave-card-${request.id}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.childName} numberOfLines={1}>
          {request.person_name ?? 'Child'}
        </Text>
        <StatusBadge
          status={request.status === 'Approved' ? 'Present' : request.status === 'Rejected' ? 'Absent' : 'Not Marked'}
          label={request.status}
          size="sm"
          testID={`leave-card-${request.id}-status`}
        />
      </View>
      <Text style={styles.dateRange}>
        {request.start_date} → {request.end_date}
      </Text>
      <Text style={styles.reason}>{request.reason}</Text>
      {request.remarks ? (
        <Text style={styles.remarks}>Admin remarks: {request.remarks}</Text>
      ) : null}
    </View>
  );
}

export default function LeaveListScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => portalApi.getLeaveRequests(),
    staleTime: 5_000, // Refresh every 5 seconds for leave status updates
  });

  // Auto-refetch when screen gains focus
  useRefetchOnFocus(['leave-requests']);

  const groups = useMemo(
    () => groupByStatus(data?.data ?? []),
    [data]
  );

  const goToForm = (): void => navigation.navigate('LeaveForm');

  let body: React.ReactElement;
  if (isLoading) {
    body = <SkeletonLoader count={4} />;
  } else if (isError) {
    body = (
      <ErrorState
        message="We could not load your leave requests. Please try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  } else if (groups.length === 0) {
    body = (
      <EmptyState
        icon="📝"
        title="No leave requests yet"
        message="Submit a leave request to notify the school about a planned absence."
        actionLabel="New Leave Request"
        onAction={goToForm}
      />
    );
  } else {
    body = (
      <ScrollView
        contentContainerStyle={styles.listContent}
        testID="leave-list"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { void refetch(); }}
            colors={[colors.primary]}
          />
        }
      >
        {groups.map((group) => (
          <View key={group.status} style={styles.group}>
            <Text style={styles.groupHeading} testID={`leave-group-${group.status}`}>
              {group.status} ({group.items.length})
            </Text>
            {group.items.map((request) => (
              <LeaveCard key={request.id} request={request} />
            ))}
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {body}
      <TouchableOpacity
        style={styles.fab}
        onPress={goToForm}
        accessibilityRole="button"
        accessibilityLabel="New leave request"
        testID="new-leave-request-button"
      >
        <Text style={styles.fabText}>+ New Leave Request</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 96,
  },
  group: {
    marginBottom: spacing.xl,
  },
  groupHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  dateRange: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  reason: {
    fontSize: 14,
    color: colors.text,
  },
  remarks: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  fabText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 16,
  },
});
