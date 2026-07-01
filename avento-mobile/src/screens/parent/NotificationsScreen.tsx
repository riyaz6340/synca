/**
 * NotificationsScreen — the parent's notifications inbox (task 9.8).
 *
 * Behaviour:
 *  - Fetches notifications from `portalApi.getNotifications` with page/limit
 *    pagination via React Query's `useInfiniteQuery` (Requirement 7.1).
 *  - Renders notifications in reverse chronological order (most recent first)
 *    by `created_at`, using the shared {@link sortByDateDesc} helper, showing
 *    each notification's title, body and timestamp (Requirement 7.2).
 *  - Loads the next page as the user scrolls to the end (infinite scroll),
 *    showing a footer loader while the next page is fetching (Requirement 7.3).
 *  - Surfaces an unread indicator when notifications newer than the last-seen
 *    timestamp exist. The last-seen marker is persisted in AsyncStorage and is
 *    advanced once the freshest notifications have been viewed (Requirement 7.4).
 *
 * Loading/empty/error states reuse the shared SkeletonLoader, EmptyState and
 * ErrorState components.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInfiniteQuery } from '@tanstack/react-query';

import { portalApi, type Paginated } from '@/api/portal';
import { EmptyState, ErrorState, SkeletonLoader } from '@/components';
import { colors, radius, spacing } from '@/components/theme';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import type { Notification } from '@/types/models';
import { sortByDateDesc } from '@/utils/sortByDate';

/** Page size requested from the backend per page. */
const PAGE_SIZE = 20;

/** AsyncStorage key tracking the most recent notification the parent has seen. */
export const LAST_SEEN_STORAGE_KEY = 'notifications:lastSeenAt';

/**
 * Count how many notifications are newer than the supplied last-seen timestamp.
 * A null/empty last-seen marker means every notification is considered unread.
 *
 * Pure and exported so the unread logic can be unit-tested in isolation and
 * reused by the tab icon badge.
 */
export function countUnread(
  notifications: readonly Notification[],
  lastSeenAt: string | null,
): number {
  const lastSeenTime =
    lastSeenAt != null ? new Date(lastSeenAt).getTime() : Number.NaN;
  if (Number.isNaN(lastSeenTime)) {
    return notifications.length;
  }
  return notifications.filter(
    (n) => new Date(n.created_at).getTime() > lastSeenTime,
  ).length;
}

/** Format an ISO timestamp into a short, human-readable label. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function NotificationRow({
  notification,
}: {
  notification: Notification;
}): React.ReactElement {
  return (
    <View style={styles.card} testID={`notification-item-${notification.id}`}>
      <Text style={styles.cardTitle} testID={`notification-title-${notification.id}`}>
        {notification.title}
      </Text>
      <Text style={styles.cardBody} numberOfLines={3}>
        {notification.body}
      </Text>
      <Text style={styles.cardTimestamp}>
        {formatTimestamp(notification.created_at)}
      </Text>
    </View>
  );
}

export default function NotificationsScreen(): React.ReactElement {
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [lastSeenLoaded, setLastSeenLoaded] = useState(false);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['parent', 'notifications'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => portalApi.getNotifications({ page: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage: Paginated<Notification>) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    staleTime: 10_000, // Refresh quickly for real-time notifications
  });

  // Auto-refetch when screen gains focus
  useRefetchOnFocus(['parent', 'notifications']);

  // Load the persisted last-seen marker once on mount.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_SEEN_STORAGE_KEY);
        if (active) {
          setLastSeenAt(stored);
        }
      } catch {
        // A storage read failure simply means everything appears unread.
      } finally {
        if (active) {
          setLastSeenLoaded(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Flatten the paged responses and present them most-recent-first.
  const notifications = useMemo(() => {
    const all = (data?.pages ?? []).flatMap((p) => p.data);
    return sortByDateDesc(all, (n) => n.created_at);
  }, [data]);

  const unreadCount = useMemo(
    () => (lastSeenLoaded ? countUnread(notifications, lastSeenAt) : 0),
    [notifications, lastSeenAt, lastSeenLoaded],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /** Advance the last-seen marker to the freshest notification. */
  const markAllSeen = useCallback(() => {
    const newest = notifications[0]?.created_at;
    if (newest == null) {
      return;
    }
    setLastSeenAt(newest);
    void AsyncStorage.setItem(LAST_SEEN_STORAGE_KEY, newest).catch(() => {
      // Persistence is best-effort; UI already reflects the seen state.
    });
  }, [notifications]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Notification>) => (
      <NotificationRow notification={item} />
    ),
    [],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) {
      return null;
    }
    return (
      <View style={styles.footer} testID="notifications-footer-loader">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage]);

  if (isPending) {
    return <SkeletonLoader count={6} testID="notifications-skeleton" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load notifications"
        message="We could not load your notifications. Please try again."
        onRetry={() => {
          void refetch();
        }}
        testID="notifications-error"
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Notifications
        </Text>
        {unreadCount > 0 ? (
          <View
            style={styles.unreadBadge}
            testID="notifications-unread-indicator"
            accessibilityLabel={`${unreadCount} unread notifications`}
          >
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyContent : styles.listContent
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        onScrollBeginDrag={markAllSeen}
        testID="notifications-list"
        ListEmptyComponent={
          <EmptyState
            icon="🔔"
            title="No notifications"
            message="You're all caught up. New notifications will appear here."
            testID="notifications-empty"
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
  unreadBadge: {
    marginLeft: spacing.sm,
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '700',
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
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardBody: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardTimestamp: {
    fontSize: 12,
    color: colors.textMuted,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
