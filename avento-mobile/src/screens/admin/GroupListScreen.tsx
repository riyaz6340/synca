/**
 * GroupListScreen — the Admin "Attendance" landing screen (task 11.2).
 *
 * Lists every group (class) with its member count and a clear indicator of
 * whether attendance has already been marked for today (Requirement 10.1).
 * Tapping a group navigates to {@link BulkMarkingScreen} carrying the group id
 * and name so the Admin can mark the class (Requirement 10.2).
 *
 * Behaviour:
 *  - Fetches groups via {@link adminApi.getGroups} (GET /api/groups) using
 *    React Query.
 *  - Shows {@link SkeletonLoader} placeholders during the initial load and an
 *    {@link ErrorState} (with retry) when the fetch fails with no cached data.
 *  - Supports pull-to-refresh to re-fetch the latest marking status.
 *
 * Validates: Requirements 10.1, 10.2
 */
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect } from 'react';

import { adminApi } from '@/api/admin';
import {
  EmptyState,
  ErrorState,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import type { Group } from '@/types/models';
import type { AdminAttendanceStackParamList } from '@/types/navigation';

/** React Query key for the admin groups list. */
export const ADMIN_GROUPS_QUERY_KEY = ['admin', 'groups'] as const;

type NavProp = NativeStackNavigationProp<AdminAttendanceStackParamList, 'GroupList'>;

export default function GroupListScreen() {
  const navigation = useNavigation<NavProp>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('AttendanceCalendar')}
          accessibilityRole="button"
          accessibilityLabel="Attendance Calendar"
          testID="calendar-nav-button"
          style={{ marginRight: spacing.md }}
        >
          <Text style={{ fontSize: 22 }}>📅</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ADMIN_GROUPS_QUERY_KEY,
    queryFn: adminApi.getGroups,
  });

  if (isLoading) {
    return <SkeletonLoader testID="group-list-skeleton" />;
  }

  if (isError && !data) {
    return (
      <ErrorState
        testID="group-list-error"
        title="Couldn't load groups"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const groups: Group[] = data ?? [];

  return (
    <View style={styles.container} testID="group-list-screen">
      <FlatList
        testID="group-list"
        data={groups}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={() => {
          void refetch();
        }}
        contentContainerStyle={
          groups.length === 0 ? styles.emptyContent : styles.listContent
        }
        renderItem={({ item }) => {
          const marked = item.attendance_marked_today;
          return (
            <Pressable
              accessibilityRole="button"
              testID={`group-row-${item.id}`}
              style={styles.row}
              onPress={() =>
                navigation.navigate('AttendanceMode', {
                  groupId: item.id,
                  groupName: item.name,
                })
              }
            >
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.member_count} {item.member_count === 1 ? 'student' : 'students'}
                </Text>
              </View>
              <View
                testID={`group-status-${item.id}`}
                style={[
                  styles.statusPill,
                  marked ? styles.statusMarked : styles.statusUnmarked,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    marked ? styles.statusTextMarked : styles.statusTextUnmarked,
                  ]}
                >
                  {marked ? 'Marked today' : 'Not marked'}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            testID="group-list-empty"
            icon="🏫"
            title="No groups yet"
            message="There are no groups to mark attendance for."
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
  meta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  statusPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  statusMarked: {
    backgroundColor: colors.present,
  },
  statusUnmarked: {
    backgroundColor: colors.warningSurface,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextMarked: {
    color: colors.primaryText,
  },
  statusTextUnmarked: {
    color: colors.warningText,
  },
});
