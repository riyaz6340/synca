/**
 * HomeScreen — the Parent "children status" home screen (task 9.1).
 *
 * Shows the authenticated parent's children with today's presence status as a
 * color-coded list. Behaviour:
 *  - Fetches the children list (with current status) from `/api/portal/persons`
 *    via {@link portalApi.getPersons} using React Query (Requirement 3.1).
 *  - Renders each child's name and a color-coded {@link StatusBadge}. Children
 *    with no attendance record today (`current_status === null`) display
 *    "Not Marked" (Requirements 3.2, 3.3).
 *  - Supports pull-to-refresh to re-fetch the latest data (Requirement 3.4).
 *  - When the device is offline, shows the last cached data with an
 *    {@link OfflineBanner} warning the data may be outdated (Requirement 3.5).
 *  - When a fetch fails and no cached data exists, shows an {@link ErrorState}
 *    with a retry button; when a refetch fails but cached data is still
 *    available, shows the cached data with a stale-data banner + retry
 *    (Requirement 3.5).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';

import { portalApi } from '@/api/portal';
import {
  EmptyState,
  ErrorState,
  OfflineBanner,
  SkeletonLoader,
  StatusBadge,
  colors,
  radius,
  spacing,
} from '@/components';
import type { PersonWithStatus } from '@/types/models';

/** React Query key for the parent's children-with-status list. */
export const PARENT_PERSONS_QUERY_KEY = ['parent', 'persons'] as const;

/**
 * Subscribe to device connectivity and report whether it is currently offline.
 *
 * Uses an initial {@link NetInfo.fetch} plus an `addEventListener` subscription
 * so the value tracks connectivity changes. `isInternetReachable` may be `null`
 * while it is being determined; we treat unknown-but-connected as online to
 * avoid a false offline flash.
 */
function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let mounted = true;

    const apply = (isConnected: boolean | null, reachable: boolean | null): void => {
      if (mounted) {
        setOffline(!(Boolean(isConnected) && reachable !== false));
      }
    };

    void NetInfo.fetch()
      .then((state) => apply(state.isConnected, state.isInternetReachable))
      .catch(() => {
        /* ignore — keep last known state */
      });

    const unsubscribe = NetInfo.addEventListener((state) =>
      apply(state.isConnected, state.isInternetReachable),
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return offline;
}

export default function HomeScreen() {
  const offline = useIsOffline();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: PARENT_PERSONS_QUERY_KEY,
    queryFn: portalApi.getPersons,
  });

  // Initial load with no cached data yet → skeleton placeholders.
  if (isLoading) {
    return <SkeletonLoader testID="home-skeleton" />;
  }

  // Fetch failed and there is no cached data to fall back on → full error state.
  if (isError && !data) {
    return (
      <ErrorState
        testID="home-error"
        title="Couldn't load your children"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const children: PersonWithStatus[] = data ?? [];

  return (
    <View style={styles.container} testID="home-screen">
      <OfflineBanner offline={offline} />

      {/* Refetch failed but cached data remains → warn it may be outdated. */}
      {isError && data ? (
        <View style={styles.staleBanner} testID="home-stale-banner">
          <Text style={styles.staleText}>
            Couldn't refresh. Showing data that may be outdated.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void refetch();
            }}
            style={styles.staleRetry}
            testID="home-stale-retry"
          >
            <Text style={styles.staleRetryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        testID="home-children-list"
        data={children}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={() => {
          void refetch();
        }}
        contentContainerStyle={
          children.length === 0 ? styles.emptyContent : styles.listContent
        }
        renderItem={({ item }) => (
          <View style={styles.row} testID={`child-row-${item.id}`}>
            <View style={styles.rowBody}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.current_status?.time ? (
                <Text style={styles.time} numberOfLines={1}>
                  Marked at {item.current_status.time}
                </Text>
              ) : null}
            </View>
            <StatusBadge
              status={item.current_status?.presence_status ?? 'Not Marked'}
              testID={`child-status-${item.id}`}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            testID="home-empty"
            icon="👋"
            title="No children yet"
            message="There are no children linked to your account."
          />
        }
      />
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
    marginBottom: spacing.md,
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
  time: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warningSurface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    margin: spacing.sm,
  },
  staleText: {
    flex: 1,
    color: colors.warningText,
    fontSize: 13,
    fontWeight: '500',
  },
  staleRetry: {
    marginLeft: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  staleRetryText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
});
