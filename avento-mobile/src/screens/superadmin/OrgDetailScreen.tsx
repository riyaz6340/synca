/**
 * OrgDetailScreen — the SuperAdmin organization detail screen (task 14.2).
 *
 * Shows the full details for a single organization fetched from
 * `GET /api/super-admin/organizations/:id` via
 * {@link superAdminApi.getOrganizationDetail} (Requirement 19.4): the plan,
 * user count, person count, and creation date. An "Edit" action opens the
 * {@link OrgFormScreen} in edit mode carrying `{ orgId }` (Requirement 19.5).
 *
 * Skeleton placeholder during the initial load and an {@link ErrorState}
 * (with retry) on failure.
 *
 * Validates: Requirements 19.4, 19.5
 */
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { superAdminApi } from '@/api/superadmin';
import { ErrorState, SkeletonLoader, colors, radius, spacing } from '@/components';
import type { SuperAdminOrganizationsStackParamList } from '@/types/navigation';

type RouteProps = RouteProp<SuperAdminOrganizationsStackParamList, 'OrgDetail'>;
type NavProp = NativeStackNavigationProp<
  SuperAdminOrganizationsStackParamList,
  'OrgDetail'
>;

/** React Query key factory for a single organization's detail. */
export const superAdminOrgDetailQueryKey = (orgId: string) =>
  ['superadmin', 'organization', orgId] as const;

/** Format an ISO timestamp into a short, locale-friendly date. */
function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export default function OrgDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const orgId = route.params.orgId;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: superAdminOrgDetailQueryKey(orgId),
    queryFn: () => superAdminApi.getOrganizationDetail(orgId),
  });

  if (isLoading) {
    return <SkeletonLoader testID="org-detail-skeleton" />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        testID="org-detail-error"
        title="Couldn't load organization"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="org-detail-screen"
    >
      <View style={styles.headerCard}>
        <Text style={styles.name} testID="org-detail-name">
          {data.name}
        </Text>
        <View style={styles.planPill} testID="org-detail-plan">
          <Text style={styles.planText}>{data.plan_type || 'No plan'}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue} testID="org-detail-user-count">
            {data.user_count}
          </Text>
          <Text style={styles.statLabel}>Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue} testID="org-detail-person-count">
            {data.person_count}
          </Text>
          <Text style={styles.statLabel}>People</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Plan</Text>
          <Text style={styles.infoValue} testID="org-detail-plan-info">
            {data.plan_type || 'No plan'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue} testID="org-detail-created">
            {formatDate(data.created_at)}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        style={styles.editButton}
        onPress={() => navigation.navigate('OrgForm', { orgId })}
        testID="org-detail-edit"
      >
        <Text style={styles.editButtonText}>Edit organization</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  planPill: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  editButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});
