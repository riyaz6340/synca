/**
 * GroupsScreen — the Admin "Management → Groups" landing screen (task 12.2).
 *
 * Lists every group (class) with its member count (Requirement 12.1) and lets
 * the Admin add a new group or open an existing one. Tapping a group navigates
 * to {@link GroupFormScreen} carrying the group id so it can serve as the
 * detail + edit + member-management view (Requirement 12.4). The "Add Group"
 * button navigates to the same form with no params for creation
 * (Requirement 12.2).
 *
 * Behaviour:
 *  - Fetches groups via {@link adminApi.getGroups} (GET /api/groups) using
 *    React Query.
 *  - Shows {@link SkeletonLoader} placeholders during the initial load and an
 *    {@link ErrorState} (with retry) when the fetch fails with no cached data.
 *  - Supports pull-to-refresh to re-fetch the latest list.
 *
 * Validates: Requirements 12.1, 12.2, 12.4
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
import type { Group } from '@/types/models';
import type { AdminManagementStackParamList } from '@/types/navigation';

/** React Query key for the admin groups list (shared with the form screen). */
export const GROUPS_QUERY_KEY = ['admin', 'groups'] as const;

type NavProp = NativeStackNavigationProp<AdminManagementStackParamList, 'Groups'>;

export default function GroupsScreen() {
  const navigation = useNavigation<NavProp>();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: GROUPS_QUERY_KEY,
    queryFn: adminApi.getGroups,
  });

  if (isLoading) {
    return <SkeletonLoader testID="groups-skeleton" />;
  }

  if (isError && !data) {
    return (
      <ErrorState
        testID="groups-error"
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
    <View style={styles.container} testID="groups-screen">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <Pressable
          accessibilityRole="button"
          testID="groups-add-button"
          style={styles.addButton}
          onPress={() => navigation.navigate('GroupForm', undefined)}
        >
          <Text style={styles.addButtonText}>+ Add Group</Text>
        </Pressable>
      </View>

      <FlatList
        testID="groups-list"
        data={groups}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={() => {
          void refetch();
        }}
        contentContainerStyle={
          groups.length === 0 ? styles.emptyContent : styles.listContent
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            testID={`group-row-${item.id}`}
            style={styles.row}
            onPress={() => navigation.navigate('GroupForm', { groupId: item.id })}
          >
            <View style={styles.rowBody}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.description ? (
                <Text style={styles.description} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <Text style={styles.meta} testID={`group-member-count-${item.id}`}>
              {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            testID="groups-empty"
            icon="🏫"
            title="No groups yet"
            message="Create a group to organize students into classes."
            actionLabel="Add Group"
            onAction={() => navigation.navigate('GroupForm', undefined)}
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  addButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
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
  description: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
