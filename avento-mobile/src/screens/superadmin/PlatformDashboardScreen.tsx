/**
 * PlatformDashboardScreen — the SuperAdmin platform-wide statistics dashboard
 * (task 14.1).
 *
 * Behaviour:
 *  - Fetches platform-wide statistics from the Backend_API
 *    (`GET /api/super-admin/dashboard`) via {@link superAdminApi.getPlatformDashboard}
 *    using React Query (Requirement 18.1).
 *  - Displays total organizations, total users, and total persons counts, plus
 *    today's platform-wide attendance statistics aggregated from the
 *    `today_attendance` status buckets (Requirement 18.2).
 *  - Supports pull-to-refresh to re-fetch all platform statistics
 *    (Requirement 18.3).
 *  - Shows a {@link SkeletonLoader} on the initial load and an {@link ErrorState}
 *    with retry when the fetch fails and there is no cached data.
 *
 * Validates: Requirements 18.1, 18.2, 18.3
 */
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  superAdminApi,
  type PlatformAttendanceBucket,
  type PlatformDashboardResponse,
} from '@/api/superadmin';
import type { PresenceStatus } from '@/types/models';
import {
  ErrorState,
  PullToRefresh,
  SkeletonLoader,
  getStatusVisual,
  colors,
  radius,
  spacing,
} from '@/components';

/** Build the React Query key for the SuperAdmin platform dashboard. */
export function platformDashboardQueryKey(): readonly [string, string] {
  return ['superadmin', 'dashboard'] as const;
}

/** Sum the `count` across every today-attendance status bucket. */
export function sumAttendanceBuckets(buckets: PlatformAttendanceBucket[]): number {
  return buckets.reduce(
    (total: number, bucket: PlatformAttendanceBucket) => total + bucket.count,
    0,
  );
}

interface StatTileProps {
  label: string;
  count: number;
  color: string;
  testID: string;
}

/** A single color-coded statistic tile. */
function StatTile({ label, count, color, testID }: StatTileProps) {
  return (
    <View testID={testID} style={[styles.tile, { borderLeftColor: color }]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileCount, { color }]} testID={`${testID}-count`}>
        {count}
      </Text>
    </View>
  );
}

export default function PlatformDashboardScreen() {
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: platformDashboardQueryKey(),
    queryFn: () => superAdminApi.getPlatformDashboard(),
  });

  // Initial load with no cached data yet → skeleton placeholders.
  if (isLoading) {
    return <SkeletonLoader testID="platform-dashboard-skeleton" count={4} />;
  }

  // Fetch failed and there is no cached data to fall back on → full error state.
  if (isError && !data) {
    return (
      <ErrorState
        testID="platform-dashboard-error"
        title="Couldn't load the dashboard"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const dashboard: PlatformDashboardResponse = data!;
  const { overview, today_attendance } = dashboard;
  const todayTotal = sumAttendanceBuckets(today_attendance);

  return (
    <PullToRefresh
      testID="platform-dashboard-scroll"
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
      contentContainerStyle={styles.content}
      style={styles.container}
    >
      <Text style={styles.heading}>Platform Overview</Text>

      {/* Platform-wide totals. */}
      <View style={styles.grid}>
        <StatTile
          testID="platform-total-organizations"
          label="Organizations"
          count={overview.total_organizations}
          color={colors.primary}
        />
        <StatTile
          testID="platform-total-users"
          label="Users"
          count={overview.total_users}
          color={colors.onLeave}
        />
        <StatTile
          testID="platform-total-persons"
          label="Persons"
          count={overview.total_persons}
          color={colors.present}
        />
        <StatTile
          testID="platform-total-attendance-records"
          label="Attendance Records"
          count={overview.total_attendance_records}
          color={colors.late}
        />
      </View>

      {/* Today's platform-wide attendance. */}
      <Text style={styles.sectionHeading}>Today's Attendance</Text>
      <View style={styles.totalCard} testID="platform-today-total">
        <Text style={styles.totalLabel}>Marked Today (All Organizations)</Text>
        <Text style={styles.totalValue} testID="platform-today-total-count">
          {todayTotal}
        </Text>
      </View>

      {today_attendance.length > 0 ? (
        <View style={styles.grid}>
          {today_attendance.map((bucket: PlatformAttendanceBucket) => {
            const visual = getStatusVisual(bucket.presence_status as PresenceStatus);
            return (
              <StatTile
                key={bucket.presence_status}
                testID={`platform-today-${bucket.presence_status}`}
                label={visual.label}
                count={bucket.count}
                color={visual.color}
              />
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyToday} testID="platform-today-empty">
          No attendance has been marked across the platform today.
        </Text>
      )}
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
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.md,
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
  emptyToday: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
