/**
 * AnalyticsScreen — displays platform-wide DAU, WAU, MAU, YAU metric cards
 * for the SuperAdmin user (task 16.1).
 *
 * Behaviour:
 *  - Fetches metrics from GET /api/super-admin/analytics via
 *    {@link superAdminAnalyticsApi.getAnalyticsMetrics} using React Query.
 *  - Displays four metric cards: DAU, WAU, MAU, YAU with their counts.
 *  - Shows a {@link SkeletonLoader} while loading.
 *  - Shows an {@link ErrorState} with retry when the fetch fails and there is
 *    no cached data.
 *
 * Validates: Requirements 10.1, 10.6
 */
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  superAdminAnalyticsApi,
  type AnalyticsMetricsResponse,
} from '@/api/superadmin';
import {
  ErrorState,
  PullToRefresh,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';

/** Build the React Query key for the SuperAdmin analytics metrics. */
export function analyticsMetricsQueryKey(): readonly [string, string] {
  return ['superadmin', 'analytics'] as const;
}

interface MetricCardProps {
  label: string;
  description: string;
  value: number;
  color: string;
  testID: string;
}

/** A single metric card showing a label, description, and value. */
function MetricCard({ label, description, value, color, testID }: MetricCardProps) {
  return (
    <View testID={testID} style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, { color }]} testID={`${testID}-value`}>
        {value}
      </Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: analyticsMetricsQueryKey(),
    queryFn: () => superAdminAnalyticsApi.getAnalyticsMetrics(),
  });

  // Initial load → skeleton placeholders.
  if (isLoading) {
    return <SkeletonLoader testID="analytics-skeleton" count={4} />;
  }

  // Fetch failed with no cached data → error state with retry.
  if (isError && !data) {
    return (
      <ErrorState
        testID="analytics-error"
        title="Metrics unavailable"
        message="We couldn't load the analytics data. Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const metrics: AnalyticsMetricsResponse = data!;

  return (
    <PullToRefresh
      testID="analytics-scroll"
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
      contentContainerStyle={styles.content}
      style={styles.container}
    >
      <Text style={styles.heading}>Platform Analytics</Text>

      <View style={styles.grid}>
        <MetricCard
          testID="analytics-dau"
          label="DAU"
          description="Daily Active Users"
          value={metrics.dau}
          color={colors.primary}
        />
        <MetricCard
          testID="analytics-wau"
          label="WAU"
          description="Weekly Active Users"
          value={metrics.wau}
          color={colors.present}
        />
        <MetricCard
          testID="analytics-mau"
          label="MAU"
          description="Monthly Active Users"
          value={metrics.mau}
          color={colors.late}
        />
        <MetricCard
          testID="analytics-yau"
          label="YAU"
          description="Yearly Active Users"
          value={metrics.yau}
          color={colors.onLeave}
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
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  cardDescription: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
