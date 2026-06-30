/**
 * StudentsScreen — the Admin "Management → Students" landing screen (task 12.1).
 *
 * Shows a paginated, searchable, group-filterable roster of persons
 * (students) fetched from `GET /api/persons` via {@link adminApi.getPersons}
 * (Requirement 11.1). Tapping a student opens the {@link StudentFormScreen} in
 * edit/detail mode carrying `{ personId }` (Requirement 11.4); the "Add
 * Student" button opens the same screen in create mode (Requirement 11.2).
 *
 * Behaviour:
 *  - Search box filters by name/roll/admission — the typed value is passed as
 *    the `search` query param so the backend re-filters (Requirement 11.1).
 *  - An optional group filter (SearchableDropdown over {@link adminApi.getGroups})
 *    narrows the list to a single group via the `group_id` param.
 *  - Page navigation (Prev / Next) walks the paginated result; the previous
 *    page stays visible while the next page loads (no flicker).
 *  - Skeleton placeholders during the initial load, an {@link ErrorState}
 *    (with retry) on failure, and an {@link EmptyState} when nothing matches.
 *
 * Validates: Requirements 11.1, 11.2, 11.4
 */
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { adminApi } from '@/api/admin';
import {
  EmptyState,
  ErrorState,
  SearchableDropdown,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import type { Group, Person } from '@/types/models';
import type { AdminManagementStackParamList } from '@/types/navigation';

/** Page size for the persons roster. */
export const STUDENTS_PAGE_SIZE = 20;

/** React Query key factory for the admin persons list. */
export const adminPersonsQueryKey = (
  page: number,
  search: string,
  groupId: string | undefined,
) => ['admin', 'persons', { page, search, groupId }] as const;

type NavProp = NativeStackNavigationProp<AdminManagementStackParamList, 'Students'>;

export default function StudentsScreen() {
  const navigation = useNavigation<NavProp>();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [groupFilter, setGroupFilter] = useState<Group | null>(null);

  const groupId = groupFilter?.id;

  const { data: groups = [] } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: adminApi.getGroups,
  });

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: adminPersonsQueryKey(page, search, groupId),
    queryFn: () =>
      adminApi.getPersons({
        page,
        limit: STUDENTS_PAGE_SIZE,
        search: search.trim() ? search.trim() : undefined,
        group_id: groupId,
      }),
    placeholderData: keepPreviousData,
  });

  const persons: Person[] = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  /** Reset to the first page whenever a filter changes. */
  const onChangeSearch = (value: string): void => {
    setSearch(value);
    setPage(1);
  };

  const onChangeGroup = (group: Group | null): void => {
    setGroupFilter(group);
    setPage(1);
  };

  return (
    <View style={styles.container} testID="students-screen">
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={onChangeSearch}
          placeholder="Search students…"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          testID="students-search"
        />

        <View style={styles.filterRow}>
          <View style={styles.filterDropdown}>
            <SearchableDropdown<Group>
              items={groups}
              getLabel={(g) => g.name}
              getKey={(g) => g.id}
              selected={groupFilter}
              onSelect={onChangeGroup}
              placeholder="All groups"
              searchPlaceholder="Search groups…"
              emptyText="No groups found"
              testID="students-group-filter"
            />
          </View>
          {groupFilter ? (
            <Pressable
              accessibilityRole="button"
              style={styles.clearFilter}
              onPress={() => onChangeGroup(null)}
              testID="students-group-filter-clear"
            >
              <Text style={styles.clearFilterText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.addButton}
          onPress={() => navigation.navigate('StudentForm')}
          testID="students-add"
        >
          <Text style={styles.addButtonText}>+ Add Student</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <SkeletonLoader testID="students-skeleton" />
      ) : isError && !data ? (
        <ErrorState
          testID="students-error"
          title="Couldn't load students"
          message="We couldn't reach the server. Please check your connection and try again."
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <FlatList
          testID="students-list"
          data={persons}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
          }}
          contentContainerStyle={
            persons.length === 0 ? styles.emptyContent : styles.listContent
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              testID={`student-row-${item.id}`}
              style={styles.row}
              onPress={() => navigation.navigate('StudentForm', { personId: item.id })}
            >
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[
                    item.roll_number ? `Roll ${item.roll_number}` : null,
                    item.group_name,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No group'}
                </Text>
              </View>
              {item.is_active === false ? (
                <View style={styles.inactivePill} testID={`student-inactive-${item.id}`}>
                  <Text style={styles.inactiveText}>Inactive</Text>
                </View>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              testID="students-empty"
              icon="🧑‍🎓"
              title="No students found"
              message="Try a different search, or add a new student."
            />
          }
        />
      )}

      {!isLoading && !isError && totalPages > 1 ? (
        <View style={styles.pager} testID="students-pager">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: page <= 1 }}
            style={[styles.pagerButton, page <= 1 && styles.pagerButtonDisabled]}
            disabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            testID="students-prev"
          >
            <Text style={styles.pagerButtonText}>Prev</Text>
          </Pressable>
          <Text style={styles.pagerLabel} testID="students-page-label">
            Page {page} of {totalPages}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: page >= totalPages }}
            style={[styles.pagerButton, page >= totalPages && styles.pagerButtonDisabled]}
            disabled={page >= totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            testID="students-next"
          >
            <Text style={styles.pagerButtonText}>Next</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  filterDropdown: {
    flex: 1,
  },
  clearFilter: {
    marginLeft: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  clearFilterText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  addButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addButtonText: {
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
  inactivePill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSurface,
  },
  inactiveText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warningText,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pagerButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  pagerButtonDisabled: {
    opacity: 0.4,
  },
  pagerButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  pagerLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
