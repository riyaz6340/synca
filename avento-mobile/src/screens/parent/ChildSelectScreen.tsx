/**
 * ChildSelectScreen — lets the parent pick a child before viewing attendance
 * history. This prevents the crash that occurred when AttendanceHistoryScreen
 * was the initial route (it requires personId/personName route params).
 *
 * Children are fetched from portalApi.getPersons (the same source as
 * HomeScreen). Tapping a child navigates to AttendanceHistory with the
 * selected child's id and name.
 */
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { portalApi } from '@/api/portal';
import {
  EmptyState,
  ErrorState,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import type { ParentAttendanceStackParamList } from '@/types/navigation';
import type { PersonWithStatus } from '@/types/models';

type Props = NativeStackScreenProps<ParentAttendanceStackParamList, 'ChildSelect'>;

export default function ChildSelectScreen({ navigation }: Props): React.ReactElement {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['parent', 'persons'],
    queryFn: portalApi.getPersons,
  });

  if (isLoading) {
    return <SkeletonLoader testID="child-select-skeleton" />;
  }

  if (isError && !data) {
    return (
      <ErrorState
        testID="child-select-error"
        title="Couldn't load children"
        message="Please check your connection and try again."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const children: PersonWithStatus[] = data ?? [];

  return (
    <View style={styles.container} testID="child-select-screen">
      <Text style={styles.heading} accessibilityRole="header">
        Select a child
      </Text>
      <Text style={styles.subheading}>
        Choose a child to view their attendance history.
      </Text>
      <FlatList
        testID="child-select-list"
        data={children}
        keyExtractor={(item) => item.id}
        contentContainerStyle={children.length === 0 ? styles.emptyContent : styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            testID={`child-select-row-${item.id}`}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('AttendanceHistory', {
                personId: item.id,
                personName: item.name,
              })
            }
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            testID="child-select-empty"
            icon="👋"
            title="No children"
            message="There are no children linked to your account."
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subheading: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xl,
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
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  arrow: {
    fontSize: 22,
    color: colors.textMuted,
  },
});
