/**
 * AuditLogsScreen — the Admin's audit log viewer (task 12.7).
 *
 * Behaviour:
 *  - Fetches audit log entries from `adminApi.getAuditLogs` with page/limit
 *    pagination via React Query's `useInfiniteQuery` (Requirement 17.1).
 *  - Renders each entry's action type, entity type, the user who performed the
 *    action, and a formatted timestamp (Requirement 17.2).
 *  - Loads the next page as the user scrolls to the bottom (infinite scroll),
 *    showing a footer loader while the next page is fetching (Requirement 17.3).
 *
 * NOTE: `adminApi.getAuditLogs` returns a bare `AuditLogEntry[]` (not a
 * paginated envelope), so there's no `totalPages` to page against. We page by
 * incrementing `page` and stop once a returned page contains fewer than
 * `PAGE_SIZE` items (a short/partial final page signals the end).
 *
 * Loading/empty/error states reuse the shared SkeletonLoader, EmptyState and
 * ErrorState components.
 *
 * Validates: Requirements 17.1, 17.2, 17.3
 */

import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';

import { adminApi } from '@/api/admin';
import { EmptyState, ErrorState, SkeletonLoader } from '@/components';
import { colors, radius, spacing } from '@/components/theme';
import type { AuditLogEntry } from '@/types/models';

/** Page size requested from the backend per page. */
const PAGE_SIZE = 50;

/** Format an ISO timestamp into a short, human-readable label. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function AuditLogRow({ entry }: { entry: AuditLogEntry }): React.ReactElement {
  return (
    <View style={styles.card} testID={`audit-log-item-${entry.id}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.action} testID={`audit-log-action-${entry.id}`}>
          {entry.action}
        </Text>
        <View style={styles.entityBadge}>
          <Text
            style={styles.entityBadgeText}
            testID={`audit-log-entity-${entry.id}`}
          >
            {entry.entity_type}
          </Text>
        </View>
      </View>
      <Text style={styles.user} testID={`audit-log-user-${entry.id}`}>
        {entry.user_email}
      </Text>
      <Text style={styles.timestamp} testID={`audit-log-timestamp-${entry.id}`}>
        {formatTimestamp(entry.timestamp)}
      </Text>
    </View>
  );
}

export default function AuditLogsScreen(): React.ReactElement {
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin', 'audit-logs'],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      adminApi.getAuditLogs({ page: pageParam, limit: PAGE_SIZE }),
    // The endpoint returns a bare array with no total-count metadata, so we
    // page until a returned page is shorter than the requested page size.
    getNextPageParam: (
      lastPage: AuditLogEntry[],
      allPages: AuditLogEntry[][],
    ): number | undefined =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length + 1,
  });

  const entries = useMemo<AuditLogEntry[]>(
    () => (data?.pages ?? []).flatMap((page: AuditLogEntry[]) => page),
    [data],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<AuditLogEntry>) => <AuditLogRow entry={item} />,
    [],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) {
      return null;
    }
    return (
      <View style={styles.footer} testID="audit-logs-footer-loader">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage]);

  if (isPending) {
    return <SkeletonLoader count={8} testID="audit-logs-skeleton" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load audit logs"
        message="We could not load the audit logs. Please try again."
        onRetry={() => {
          void refetch();
        }}
        testID="audit-logs-error"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Audit Logs
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item: AuditLogEntry) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          entries.length === 0 ? styles.emptyContent : styles.listContent
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        testID="audit-logs-list"
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="No audit logs"
            message="System activity will appear here as actions are performed."
            testID="audit-logs-empty"
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyContent: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  action: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  entityBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  entityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  user: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
