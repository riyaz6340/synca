/**
 * AnnouncementDetailScreen (task 9.4).
 *
 * Shows the full content of a single announcement selected from the list. The
 * announcement is resolved by `announcementId` (passed as a navigation param,
 * Requirement 5.3) from the same cached React Query that backs the list, so no
 * extra network round-trip is needed when arriving from the list. If the cache
 * is cold (e.g. deep link / process restart) the query fetches on demand.
 *
 * Renders the full title, publication date, and complete body
 * (Requirement 5.3). Shows a skeleton while loading, an error state with retry
 * on failure, and a friendly empty state if the announcement can't be found.
 *
 * Validates: Requirements 5.1, 5.3
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { colors, spacing } from '@/components/theme';
import { useAnnouncementsQuery } from '@/hooks/useAnnouncements';
import type { ParentAnnouncementsStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<
  ParentAnnouncementsStackParamList,
  'AnnouncementDetail'
>;

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

export default function AnnouncementDetailScreen({ route }: Props) {
  const { announcementId } = route.params;
  const { data, isLoading, isError, refetch } = useAnnouncementsQuery();

  if (isLoading) {
    return <SkeletonLoader count={4} testID="announcement-detail-skeleton" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load announcement"
        message="We couldn't fetch this announcement. Please try again."
        onRetry={() => {
          void refetch();
        }}
        testID="announcement-detail-error"
      />
    );
  }

  const announcement = data?.find((a) => a.id === announcementId);

  if (!announcement) {
    return (
      <EmptyState
        icon="📭"
        title="Announcement not found"
        message="This announcement may have been removed."
        testID="announcement-detail-missing"
      />
    );
  }

  return (
    <ScrollView
      testID="announcement-detail"
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title} accessibilityRole="header">
        {announcement.title}
      </Text>
      <Text style={styles.date}>
        {formatPublishedDate(announcement.published_at)}
      </Text>
      <View style={styles.divider} />
      <Text style={styles.body} testID="announcement-detail-body">
        {announcement.body}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
});
