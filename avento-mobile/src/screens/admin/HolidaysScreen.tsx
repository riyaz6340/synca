/**
 * HolidaysScreen — the Admin "Holidays" management list (task 12.6).
 *
 * Lists the organization's school holidays in chronological order (earliest
 * first) by date, showing each holiday's date, name, and description
 * (Requirement 16.4). An "Add Holiday" action navigates to
 * {@link HolidayFormScreen} (Requirement 16.2).
 *
 * Behaviour:
 *  - Fetches via {@link adminApi.getHolidays} (GET /api/holidays) through
 *    React Query (Requirement 16.1).
 *  - Orders items earliest-first by the `date` field (Requirement 16.4).
 *  - Renders SkeletonLoader while loading, ErrorState (with retry) on failure,
 *    and EmptyState (with an action to add one) when empty.
 *
 * Validates: Requirements 16.1, 16.2, 16.4
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
import type { Holiday } from '@/types/models';
import type { AdminManagementStackParamList } from '@/types/navigation';

/** React Query key for the admin holidays list. */
export const ADMIN_HOLIDAYS_QUERY_KEY = ['admin', 'holidays'] as const;

type NavProp = NativeStackNavigationProp<AdminManagementStackParamList, 'Holidays'>;

/** Coerce a YYYY-MM-DD (or ISO) date string to epoch millis for sorting. */
function toTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Return a new array of holidays sorted in chronological order (earliest
 * first) by their `date` field. The input array is not mutated. Holidays whose
 * date cannot be parsed are treated as the epoch and therefore sort first.
 */
export function sortHolidaysChronologically(items: readonly Holiday[]): Holiday[] {
  return [...items].sort((a: Holiday, b: Holiday) => toTime(a.date) - toTime(b.date));
}

/** Human-readable date label, falling back to the raw value when unparseable. */
function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function HolidaysScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ADMIN_HOLIDAYS_QUERY_KEY,
    queryFn: () => adminApi.getHolidays(),
  });

  if (isLoading) {
    return <SkeletonLoader testID="holidays-skeleton" />;
  }

  if (isError && !data) {
    return (
      <ErrorState
        testID="holidays-error"
        title="Couldn't load holidays"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  // Chronological ordering — earliest first (Requirement 16.4).
  const holidays = sortHolidaysChronologically(data ?? []);

  return (
    <View style={styles.container} testID="holidays-screen">
      <Pressable
        accessibilityRole="button"
        testID="holidays-add"
        style={styles.addButton}
        onPress={() => navigation.navigate('HolidayForm')}
      >
        <Text style={styles.addButtonText}>＋ Add Holiday</Text>
      </Pressable>

      <FlatList
        testID="holidays-list"
        data={holidays}
        keyExtractor={(item: Holiday) => item.id}
        refreshing={isRefetching}
        onRefresh={() => {
          void refetch();
        }}
        contentContainerStyle={
          holidays.length === 0 ? styles.emptyContent : styles.listContent
        }
        renderItem={({ item }: { item: Holiday }) => (
          <View style={styles.row} testID={`holiday-row-${item.id}`}>
            <Text style={styles.date} testID={`holiday-date-${item.id}`}>
              {formatDate(item.date)}
            </Text>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {item.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            testID="holidays-empty"
            icon="📅"
            title="No holidays yet"
            message="Add a holiday so it's reflected in attendance and reports."
            actionLabel="Add Holiday"
            onAction={() => navigation.navigate('HolidayForm')}
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
  addButton: {
    margin: spacing.lg,
    marginBottom: 0,
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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  description: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textMuted,
  },
});
