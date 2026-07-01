/**
 * LeaveManagementScreen — the Admin's leave-request approval queue (task 12.3).
 *
 * Fetches leave requests via {@link adminApi.getLeaveRequests}
 * (GET /api/leave-requests) with React Query and displays them grouped by
 * status with Pending first (Requirement 13.1). A badge in the header shows the
 * number of pending requests (Requirement 13.5); the same count is also exposed
 * to the rest of the app through the {@link usePendingLeaveCount} hook so a tab
 * badge can be wired up later.
 *
 * Tapping a pending request opens a detail view showing the child name, date
 * range, reason and submission date (Requirement 13.2). From a pending request
 * the Admin can:
 *  - Approve it, which calls {@link adminApi.approveLeave} (PUT approved status,
 *    Requirement 13.3) and refreshes the list.
 *  - Reject it, which opens a remarks input; a non-empty remark is required and
 *    the screen calls {@link adminApi.rejectLeave} with the remark (PUT rejected
 *    status + remarks, Requirement 13.4) and refreshes the list.
 *
 * Loading shows a skeleton, errors show a retryable error state, and an empty
 * list shows an empty state.
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import type { LeaveRequest } from '@/types/models';

type LeaveStatus = LeaveRequest['status'];

/** Display order for the status groups (Pending first — Requirement 13.1). */
const STATUS_ORDER: LeaveStatus[] = ['Pending', 'Approved', 'Rejected'];

/** React Query key for the admin leave-request list. */
export const ADMIN_LEAVE_REQUESTS_QUERY_KEY = ['admin', 'leave-requests'] as const;

/** Map a leave status to the StatusBadge presence color/label. */
function badgeStatusFor(status: LeaveStatus): 'Present' | 'Absent' | 'Not Marked' {
  if (status === 'Approved') return 'Present';
  if (status === 'Rejected') return 'Absent';
  return 'Not Marked';
}

/** Group leave requests by status preserving the canonical group order. */
export function groupByStatus(
  requests: readonly LeaveRequest[]
): Array<{ status: LeaveStatus; items: LeaveRequest[] }> {
  return STATUS_ORDER.map((status) => ({
    status,
    items: requests.filter((r) => r.status === status),
  })).filter((group) => group.items.length > 0);
}

/** Count the pending leave requests in a list. */
export function countPending(requests: readonly LeaveRequest[]): number {
  return requests.filter((r) => r.status === 'Pending').length;
}

/**
 * Hook exposing the number of pending leave requests for the organization, so a
 * navigation tab badge can consume it (Requirement 13.5). Shares the same query
 * cache as the screen.
 */
export function usePendingLeaveCount(): number {
  const { data } = useQuery({
    queryKey: ADMIN_LEAVE_REQUESTS_QUERY_KEY,
    queryFn: () => adminApi.getLeaveRequests({ page: 1, limit: 100 }),
  });
  return useMemo(() => countPending(data?.data ?? []), [data]);
}

function LeaveCard({
  request,
  onOpen,
  onApprove,
  onReject,
  isMutating,
}: {
  request: LeaveRequest;
  onOpen: (request: LeaveRequest) => void;
  onApprove: (request: LeaveRequest) => void;
  onReject: (request: LeaveRequest) => void;
  isMutating: boolean;
}): React.ReactElement {
  const isPending = request.status === 'Pending';
  return (
    <Pressable
      style={styles.card}
      testID={`leave-card-${request.id}`}
      accessibilityRole="button"
      onPress={() => onOpen(request)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.childName} numberOfLines={1}>
          {request.person_name ?? 'Child'}
        </Text>
        <StatusBadge
          status={badgeStatusFor(request.status)}
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

      {isPending ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isMutating}
            style={[styles.actionButton, styles.approveButton, isMutating && styles.disabled]}
            onPress={() => onApprove(request)}
            testID={`leave-card-${request.id}-approve`}
          >
            <Text style={styles.approveText}>Approve</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isMutating}
            style={[styles.actionButton, styles.rejectButton, isMutating && styles.disabled]}
            onPress={() => onReject(request)}
            testID={`leave-card-${request.id}-reject`}
          >
            <Text style={styles.rejectText}>Reject</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function LeaveManagementScreen(): React.ReactElement {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ADMIN_LEAVE_REQUESTS_QUERY_KEY,
    queryFn: () => adminApi.getLeaveRequests({ page: 1, limit: 100 }),
    staleTime: 5_000, // Refresh frequently for real-time leave updates
  });

  // Auto-refetch when screen gains focus
  useRefetchOnFocus(ADMIN_LEAVE_REQUESTS_QUERY_KEY);

  const requests = useMemo(() => data?.data ?? [], [data]);
  const groups = useMemo(() => groupByStatus(requests), [requests]);
  const pendingCount = useMemo(() => countPending(requests), [requests]);

  // Detail view state (Requirement 13.2).
  const [detail, setDetail] = useState<LeaveRequest | null>(null);

  // Reject remarks modal state (Requirement 13.4).
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [remarks, setRemarks] = useState('');
  const [rejectError, setRejectError] = useState(false);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_LEAVE_REQUESTS_QUERY_KEY });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveLeave(id),
    onSuccess: () => {
      setDetail(null);
      invalidate();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      adminApi.rejectLeave(id, comment),
    onSuccess: () => {
      closeRejectModal();
      setDetail(null);
      invalidate();
    },
  });

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  const openReject = (request: LeaveRequest): void => {
    setRejectTarget(request);
    setRemarks('');
    setRejectError(false);
  };

  const closeRejectModal = (): void => {
    setRejectTarget(null);
    setRemarks('');
    setRejectError(false);
  };

  const onApprove = (request: LeaveRequest): void => {
    approveMutation.mutate(request.id);
  };

  const confirmReject = (): void => {
    const trimmed = remarks.trim();
    if (trimmed.length === 0) {
      // A remark is required to reject (Requirement 13.4).
      setRejectError(true);
      return;
    }
    if (rejectTarget) {
      rejectMutation.mutate({ id: rejectTarget.id, comment: trimmed });
    }
  };

  let body: React.ReactElement;
  if (isLoading) {
    body = <SkeletonLoader count={4} testID="leave-mgmt-skeleton" />;
  } else if (isError) {
    body = (
      <ErrorState
        testID="leave-mgmt-error"
        message="We could not load leave requests. Please try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  } else if (groups.length === 0) {
    body = (
      <EmptyState
        testID="leave-mgmt-empty"
        icon="📝"
        title="No leave requests"
        message="There are no leave requests to review right now."
      />
    );
  } else {
    body = (
      <ScrollView
        contentContainerStyle={styles.listContent}
        testID="leave-mgmt-list"
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
              <LeaveCard
                key={request.id}
                request={request}
                onOpen={setDetail}
                onApprove={onApprove}
                onReject={openReject}
                isMutating={isMutating}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container} testID="leave-mgmt-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Leave Requests</Text>
        {pendingCount > 0 ? (
          <View style={styles.badge} testID="pending-badge">
            <Text style={styles.badgeText}>{pendingCount} pending</Text>
          </View>
        ) : null}
      </View>

      {body}

      {/* ── Detail view (Requirement 13.2) ─────────────────────────────── */}
      <Modal
        visible={detail !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="leave-detail-modal">
            {detail ? (
              <>
                <Text style={styles.modalTitle}>Leave Request</Text>
                <DetailRow label="Child" value={detail.person_name ?? 'Child'} />
                <DetailRow
                  label="Dates"
                  value={`${detail.start_date} → ${detail.end_date}`}
                />
                <DetailRow label="Reason" value={detail.reason} />
                {detail.leave_type ? (
                  <DetailRow label="Type" value={detail.leave_type} />
                ) : null}
                <DetailRow
                  label="Submitted"
                  value={formatSubmitted(detail.created_at)}
                  testID="leave-detail-submitted"
                />
                <DetailRow label="Status" value={detail.status} />
                {detail.remarks ? (
                  <DetailRow label="Remarks" value={detail.remarks} />
                ) : null}

                {detail.status === 'Pending' ? (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isMutating}
                      style={[styles.actionButton, styles.approveButton, isMutating && styles.disabled]}
                      onPress={() => onApprove(detail)}
                      testID="leave-detail-approve"
                    >
                      <Text style={styles.approveText}>Approve</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isMutating}
                      style={[styles.actionButton, styles.rejectButton, isMutating && styles.disabled]}
                      onPress={() => openReject(detail)}
                      testID="leave-detail-reject"
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  style={styles.closeButton}
                  onPress={() => setDetail(null)}
                  testID="leave-detail-close"
                >
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── Reject remarks modal (Requirement 13.4) ────────────────────── */}
      <Modal
        visible={rejectTarget !== null}
        animationType="slide"
        transparent
        onRequestClose={closeRejectModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="reject-modal">
            <Text style={styles.modalTitle}>Reject leave request</Text>
            <Text style={styles.modalSubtitle}>
              Add a remark explaining why this request is rejected.
            </Text>
            <TextInput
              style={styles.remarksInput}
              value={remarks}
              onChangeText={(text) => {
                setRemarks(text);
                if (text.trim().length > 0) setRejectError(false);
              }}
              placeholder="Reason for rejection"
              placeholderTextColor={colors.textMuted}
              multiline
              testID="reject-remarks-input"
            />
            {rejectError ? (
              <Text style={styles.errorText} testID="reject-error">
                A remark is required to reject a request.
              </Text>
            ) : null}
            {rejectMutation.isError ? (
              <Text style={styles.errorText} testID="reject-submit-error">
                Couldn't reject the request. Please try again.
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                style={[styles.actionButton, styles.cancelButton]}
                onPress={closeRejectModal}
                disabled={rejectMutation.isPending}
                testID="reject-cancel"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.actionButton, styles.rejectButton, rejectMutation.isPending && styles.disabled]}
                onPress={confirmReject}
                disabled={rejectMutation.isPending}
                testID="reject-confirm"
              >
                {rejectMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={styles.rejectText}>Confirm Reject</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.detailRow} testID={testID}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/** Format the submission timestamp for the detail view, falling back gracefully. */
function formatSubmitted(createdAt: string | undefined): string {
  if (!createdAt) return 'Unknown';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.warningSurface,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  badgeText: {
    color: colors.warningText,
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    padding: spacing.lg,
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
  actions: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  approveButton: {
    backgroundColor: colors.present,
  },
  approveText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 14,
  },
  rejectButton: {
    backgroundColor: colors.danger,
  },
  rejectText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: colors.surface,
  },
  cancelText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    width: 100,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  remarksInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  closeButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  closeText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
});
