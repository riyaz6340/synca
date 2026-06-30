/**
 * OrgListScreen — the SuperAdmin "Organizations" landing screen (task 14.2).
 *
 * Shows a paginated, searchable list of every organization on the platform
 * fetched from `GET /api/super-admin/organizations` via
 * {@link superAdminApi.getOrganizations} (Requirement 19.1). Each row shows the
 * organization name, plan, and person count. Tapping a row opens the
 * {@link OrgDetailScreen} carrying `{ orgId }` (Requirement 19.4); the "Add
 * Organization" button opens the {@link OrgFormScreen} in create mode
 * (Requirement 19.2).
 *
 * Behaviour:
 *  - Search box re-fetches with the `search` query param so the backend filters.
 *  - Page navigation (Prev / Next) walks the paginated result; the previous
 *    page stays visible while the next page loads (no flicker).
 *  - Skeleton placeholders during the initial load, an {@link ErrorState}
 *    (with retry) on failure, and an {@link EmptyState} when nothing matches.
 *
 * Validates: Requirements 19.1, 19.2, 19.4
 */
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { superAdminApi, type OrganizationSummary } from '@/api/superadmin';
import {
  EmptyState,
  ErrorState,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import type { SuperAdminOrganizationsStackParamList } from '@/types/navigation';

/** Page size for the organizations list. */
export const ORGS_PAGE_SIZE = 20;

/** React Query key factory for the SuperAdmin organizations list. */
export const superAdminOrgsQueryKey = (page: number, search: string) =>
  ['superadmin', 'organizations', { page, search }] as const;

type NavProp = NativeStackNavigationProp<
  SuperAdminOrganizationsStackParamList,
  'OrgList'
>;

export default function OrgListScreen() {
  const navigation = useNavigation<NavProp>();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: superAdminOrgsQueryKey(page, search),
    queryFn: () =>
      superAdminApi.getOrganizations({
        page,
        limit: ORGS_PAGE_SIZE,
        search: search.trim() ? search.trim() : undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const organizations: OrganizationSummary[] = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  /** Reset to the first page whenever the search changes. */
  const onChangeSearch = (value: string): void => {
    setSearch(value);
    setPage(1);
  };

  return (
    <View style={styles.container} testID="org-list-screen">
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={onChangeSearch}
          placeholder="Search organizations…"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          testID="org-list-search"
        />

        <Pressable
          accessibilityRole="button"
          style={styles.addButton}
          onPress={() => navigation.navigate('OrgForm')}
          testID="org-list-add"
        >
          <Text style={styles.addButtonText}>+ Add Organization</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <SkeletonLoader testID="org-list-skeleton" />
      ) : isError && !data ? (
        <ErrorState
          testID="org-list-error"
          title="Couldn't load organizations"
          message="We couldn't reach the server. Please check your connection and try again."
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <FlatList
          testID="org-list"
          data={organizations}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
          }}
          contentContainerStyle={
            organizations.length === 0 ? styles.emptyContent : styles.listContent
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              testID={`org-row-${item.id}`}
              style={styles.row}
              onPress={() => navigation.navigate('OrgDetail', { orgId: item.id })}
            >
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.person_count} {item.person_count === 1 ? 'person' : 'people'}
                </Text>
              </View>
              <View style={styles.planPill} testID={`org-plan-${item.id}`}>
                <Text style={styles.planText}>{item.plan || 'No plan'}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              testID="org-list-empty"
              icon="🏢"
              title="No organizations found"
              message="Try a different search, or add a new organization."
            />
          }
        />
      )}

      {!isLoading && !isError && totalPages > 1 ? (
        <View style={styles.pager} testID="org-list-pager">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: page <= 1 }}
            style={[styles.pagerButton, page <= 1 && styles.pagerButtonDisabled]}
            disabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            testID="org-list-prev"
          >
            <Text style={styles.pagerButtonText}>Prev</Text>
          </Pressable>
          <Text style={styles.pagerLabel} testID="org-list-page-label">
            Page {page} of {totalPages}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: page >= totalPages }}
            style={[styles.pagerButton, page >= totalPages && styles.pagerButtonDisabled]}
            disabled={page >= totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            testID="org-list-next"
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
  planPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'capitalize',
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
