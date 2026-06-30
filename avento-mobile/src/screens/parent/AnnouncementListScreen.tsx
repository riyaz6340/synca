/**
 * AnnouncementListScreen (task 9.4).
 *
 * Shows the parent's school announcements in reverse-chronological order with
 * each item's title, a short body preview, and the publication date. Tapping
 * an announcement opens the detail screen.
 *
 * Behavior:
 *  - Fetches via `portalApi.getAnnouncements` through React Query
 *    (Requirement 5.1).
 *  - Orders items most-recent-first using the shared, pure `sortByDateDesc`
 *    helper keyed on `published_at` (Requirement 5.2). The same helper is
 *    covered by the Property 13 chronological-ordering property test.
 *  - Navigates to AnnouncementDetail with `{ announcementId }` on tap
 *    (Requirement 5.3).
 *  - Once the list has loaded, records the newest publish time so the tab
 *    badge of unread announcements clears (Requirement 5.4).
 *  - Renders SkeletonLoader while loading, ErrorState (with retry) on failure,
 *    and EmptyState when there are no announcements.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */
import { useEffect, useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { colors, radius, spacing } from '@/components/theme';
import { useAnnouncementsQuery } from '@/hooks/useAnnouncements';
import { markAllSeen } from '@/services/announcementsSeen';
import type { Announcement } from '@/types/models';
import type { ParentAnnouncementsStackParamList } from '@/types/navigation';
import { sortByDateDesc } from '@/utils/sortByDate';

type Props = NativeStackScreenProps<
  ParentAnnouncementsStackParamList,
  'AnnouncementList'
>;

/** Max characters shown for the body preview before truncation. */
const PREVIEW_LENGTH = 120;

function buildPreview(body: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (normalized.length <= PREVIEW_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
}

/** Format an ISO timestamp as a human-readable publication date. */
function formatPublishedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AnnouncementListScreen({ navigation }: Props) {
  const { data, isLoading, isError, refetch, isRefetching } =
    useAnnouncementsQuery();

  // Reverse-chronological ordering via the shared pure helper (Requirement 5.2).
  const announcements = useMemo(
    () => sortByDateDesc(data ?? [], (a) => a.published_at),
    [data],
  );

  // Once the list is available, mark the newest announcement as seen so the
  // tab badge of new announcements clears (Requirement 5.4).
  useEffect(() => {
    if (data && data.length > 0) {
      void markAllSeen(data);
    }
  }, [data]);

  if (isLoading) {
    return <SkeletonLoader count={6} testID="announcements-skeleton" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load announcements"
        message="We couldn't fetch announcements. Please try again."
        onRetry={() => {
          void refetch();
        }}
        testID="announcements-error"
      />
    );
  }

  if (announcements.length === 0) {
    return (
      <EmptyState
        icon="📢"
        title="No announcements"
        message="There are no announcements to show right now."
        testID="announcements-empty"
      />
    );
  }

  const renderItem = ({ item }: { item: Announcement }) => (
    <TouchableOpacity
      style={styles.card}
      accessibilityRole="button"
      onPress={() =>
        navigation.navigate('AnnouncementDetail', { announcementId: item.id })
      }
      testID={`announcement-item-${item.id}`}
    >
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.preview} numberOfLines={2}>
        {buildPreview(item.body)}
      </Text>
      <Text style={styles.date}>{formatPublishedDate(item.published_at)}</Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      testID="announcements-list"
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={announcements}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  preview: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  date: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
