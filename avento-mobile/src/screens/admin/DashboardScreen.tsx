/**
 * DashboardScreen — the Admin "today's attendance summary" dashboard (task 11.1).
 *
 * Behaviour:
 *  - Fetches today's aggregated attendance summary from the Backend_API
 *    (`GET /api/attendance/dashboard`) via {@link adminApi.getDashboard} using
 *    React Query, keyed by the date (defaults to today, YYYY-MM-DD)
 *    (Requirement 9.1).
 *  - Displays the total number of students plus the count and percentage of
 *    students marked Present, Absent, Late, and On_Leave for today, using
 *    color-coded stat tiles (Requirement 9.2).
 *  - Displays the number of pending leave requests awaiting approval
 *    (Requirement 9.3).
 *  - Displays the count of groups (classes) not yet marked for today
 *    (Requirement 9.4).
 *  - Supports pull-to-refresh to re-fetch all dashboard data (Requirement 9.5).
 *  - Shows a {@link SkeletonLoader} on the initial load and an {@link ErrorState}
 *    with retry when the fetch fails and there is no cached data.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { adminApi, type AdminDashboardSummary } from '@/api/admin';
import {
  ErrorState,
  PullToRefresh,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';

/** Format a Date as a `YYYY-MM-DD` string in the device's local timezone. */
export function toDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Build the React Query key for the admin dashboard on a given date. */
export function adminDashboardQueryKey(date: string): readonly [string, string, string] {
  return ['admin', 'dashboard', date] as const;
}

interface StatTileProps {
  label: string;
  count: number;
  percentage?: number;
  color: string;
  testID: string;
}

/** A single color-coded statistic tile (count + optional percentage). */
function StatTile({ label, count, percentage, color, testID }: StatTileProps) {
  return (
    <View testID={testID} style={[styles.tile, { borderLeftColor: color }]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileCount, { color }]} testID={`${testID}-count`}>
        {count}
      </Text>
      {percentage !== undefined ? (
        <Text style={styles.tilePercentage} testID={`${testID}-percentage`}>
          {percentage}%
        </Text>
      ) : null}
    </View>
  );
}

export default function DashboardScreen() {
  const date = toDateString();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: adminDashboardQueryKey(date),
    queryFn: () => adminApi.getDashboard(date),
  });

  // Initial load with no cached data yet → skeleton placeholders.
  if (isLoading) {
    return <SkeletonLoader testID="dashboard-skeleton" count={4} />;
  }

  // Fetch failed and there is no cached data to fall back on → full error state.
  if (isError && !data) {
    return (
      <ErrorState
        testID="dashboard-error"
        title="Couldn't load the dashboard"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const summary: AdminDashboardSummary = data!;

  return (
    <PullToRefresh
      testID="dashboard-scroll"
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
      contentContainerStyle={styles.content}
      style={styles.container}
    >
      <Text style={styles.heading}>Today's Attendance</Text>
      <Text style={styles.date} testID="dashboard-date">
        {summary.date}
      </Text>

      {/* Total students headline. */}
      <View style={styles.totalCard} testID="dashboard-total-students">
        <Text style={styles.totalLabel}>Total Students</Text>
        <Text style={styles.totalValue} testID="dashboard-total-students-count">
          {summary.total_students}
        </Text>
      </View>

      {/* Per-status counts + percentages. */}
      <View style={styles.grid}>
        <StatTile
          testID="dashboard-present"
          label="Present"
          count={summary.present}
          percentage={summary.present_percentage}
          color={colors.present}
        />
        <StatTile
          testID="dashboard-absent"
          label="Absent"
          count={summary.absent}
          percentage={summary.absent_percentage}
          color={colors.absent}
        />
        <StatTile
          testID="dashboard-late"
          label="Late"
          count={summary.late}
          percentage={summary.late_percentage}
          color={colors.late}
        />
        <StatTile
          testID="dashboard-on-leave"
          label="On Leave"
          count={summary.on_leave}
          percentage={summary.on_leave_percentage}
          color={colors.onLeave}
        />
      </View>

      {/* Operational follow-ups. */}
      <View style={styles.grid}>
        <StatTile
          testID="dashboard-pending-leave"
          label="Pending Leave Requests"
          count={summary.pending_leave_requests}
          color={colors.warning}
        />
        <StatTile
          testID="dashboard-groups-not-marked"
          label="Groups Not Marked"
          count={summary.groups_not_marked}
          color={colors.notMarked}
        />
      </View>
    </PullToRefresh>
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
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  date: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
    marginBottom: spacing.lg,
  },
  totalCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  totalLabel: {
    fontSize: 14,
    color: colors.primaryText,
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primaryText,
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  tileLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tileCount: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  tilePercentage: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.xs / 2,
  },
});
