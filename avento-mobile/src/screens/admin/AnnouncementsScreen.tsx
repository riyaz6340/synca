/**
 * AnnouncementsScreen — the Admin "Announcements" management list (task 12.4).
 *
 * Lists the organization's announcements in reverse-chronological order
 * (Requirement 14.1) and surfaces each item's publication status and any
 * available target information together with its creation/publication date
 * (Requirement 14.5). A "New Announcement" action navigates to
 * {@link AnnouncementFormScreen} (Requirement 14.2).
 *
 * Behaviour:
 *  - Fetches via {@link adminApi.getAnnouncements} (GET /api/announcements)
 *    through React Query.
 *  - Orders items most-recent-first using the shared, pure {@link sortByDateDesc}
 *    helper keyed on `published_at` (Property 13 / Requirement 14.1).
 *  - Derives the Draft vs Published status from the presence of a
 *    `published_at` timestamp. The {@link Announcement} domain model is minimal
 *    (id, title, body, published_at); when the backend returns additional
 *    target metadata it is rendered, otherwise the target line is omitted —
 *    the model carries no first-class target field, so target info is
 *    best-effort here.
 *  - Renders SkeletonLoader while loading, ErrorState (with retry) on failure,
 *    and EmptyState (with an action to create one) when empty.
 *
 * Validates: Requirements 14.1, 14.2, 14.5
 */
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '@/api/admin';
import {
  EmptyState,
  ErrorState,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import type { Announcement } from '@/types/models';
import type { AdminManagementStackParamList } from '@/types/navigation';
import { sortByDateDesc } from '@/utils/sortByDate';

/** React Query key for the admin announcements list. */
export const ADMIN_ANNOUNCEMENTS_QUERY_KEY = ['admin', 'announcements'] as const;

type NavProp = NativeStackNavigationProp<
  AdminManagementStackParamList,
  'Announcements'
>;

/**
 * The backend may attach optional targeting metadata that the minimal
 * {@link Announcement} domain model does not declare. Read it defensively so
 * the row can surface target info when present without forcing a model change.
 */
type AnnouncementWithTarget = Announcement & {
  target_type?: string | null;
  target_names?: string[] | null;
};

/** True when the announcement has been published (has a publish timestamp). */
function isPublished(item: Announcement): boolean {
  return Boolean(item.published_at) && !Number.isNaN(new Date(item.published_at).getTime());
}

/** Human-readable creation/publication date, or empty string when unavailable. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
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

/** Best-effort, human-readable target description from optional backend fields. */
function describeTarget(item: AnnouncementWithTarget): string | null {
  if (!item.target_type) {
    return null;
  }
  const names =
    item.target_names && item.target_names.length > 0
      ? `: ${item.target_names.join(', ')}`
      : '';
  return `${item.target_type}${names}`;
}

export default function AnnouncementsScreen() {
  const navigation = useNavigation<NavProp>();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ADMIN_ANNOUNCEMENTS_QUERY_KEY,
    queryFn: adminApi.getAnnouncements,
  });

  if (isLoading) {
    return <SkeletonLoader testID="announcements-skeleton" />;
  }

  if (isError && !data) {
    return (
      <ErrorState
        testID="announcements-error"
        title="Couldn't load announcements"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  // Reverse-chronological ordering via the shared pure helper (Requirement 14.1).
  const announcements = sortByDateDesc(
    (data ?? []) as Announcement[],
    (a) => a.published_at,
  );

  return (
    <View style={styles.container} testID="announcements-screen">
      <Pressable
        accessibilityRole="button"
        testID="announcements-new"
        style={styles.newButton}
        onPress={() => navigation.navigate('AnnouncementForm')}
      >
        <Text style={styles.newButtonText}>＋ New Announcement</Text>
      </Pressable>

      <FlatList
        testID="announcements-list"
        data={announcements}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={() => {
          void refetch();
        }}
        contentContainerStyle={
          announcements.length === 0 ? styles.emptyContent : styles.listContent
        }
        renderItem={({ item }) => {
          const published = isPublished(item);
          const target = describeTarget(item as AnnouncementWithTarget);
          const dateLabel = formatDate(item.published_at);
          return (
            <View style={styles.row} testID={`announcement-row-${item.id}`}>
              <View style={styles.rowHeader}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <View
                  testID={`announcement-status-${item.id}`}
                  style={[
                    styles.statusPill,
                    published ? styles.statusPublished : styles.statusDraft,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      published
                        ? styles.statusTextPublished
                        : styles.statusTextDraft,
                    ]}
                  >
                    {published ? 'Published' : 'Draft'}
                  </Text>
                </View>
              </View>

              <Text style={styles.body} numberOfLines={2}>
                {item.body}
              </Text>

              <View style={styles.metaRow}>
                {target ? (
                  <Text
                    style={styles.meta}
                    numberOfLines={1}
                    testID={`announcement-target-${item.id}`}
                  >
                    🎯 {target}
                  </Text>
                ) : null}
                {dateLabel ? <Text style={styles.meta}>{dateLabel}</Text> : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            testID="announcements-empty"
            icon="📢"
            title="No announcements yet"
            message="Create an announcement to communicate with parents."
            actionLabel="New Announcement"
            onAction={() => navigation.navigate('AnnouncementForm')}
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
  newButton: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  newButtonText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.lg,
  },
  emptyContent: {
    flexGrow: 1,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    marginRight: spacing.md,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statusPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  statusPublished: {
    backgroundColor: colors.present,
  },
  statusDraft: {
    backgroundColor: colors.warningSurface,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextPublished: {
    color: colors.primaryText,
  },
  statusTextDraft: {
    color: colors.warningText,
  },
});
