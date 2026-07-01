/**
 * TeacherGroupListScreen — the Teacher "Attendance" landing screen.
 *
 * Unlike the Admin GroupListScreen (which shows ALL org groups), this screen
 * shows only the groups assigned to the current Teacher. If no groups are
 * assigned, it displays an empty state message.
 *
 * Before rendering, it checks that the Teacher has the required permission
 * (mark_attendance or view_attendance_reports). If not, it shows the
 * PermissionDeniedScreen.
 *
 * Validates: Requirements 1.6, 4.4, 4.5
 */
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';

import {
  EmptyState,
  ErrorState,
  SkeletonBlock,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import { PermissionDeniedScreen } from '@/components/PermissionDeniedScreen';
import { useTeacherGroups } from '@/hooks/useTeacherGroups';
import { useTeacherPermissions } from '@/hooks/useTeacherPermissions';
import { useAuthStore } from '@/stores/auth';
import { getDisplayName } from '@/utils/getDisplayName';
import type { Group } from '@/types/models';
import type { TeacherAttendanceStackParamList } from '@/types/navigation';

type NavProp = NativeStackNavigationProp<TeacherAttendanceStackParamList, 'GroupList'>;

export default function TeacherGroupListScreen() {
  const navigation = useNavigation<NavProp>();
  const { hasAnyPermission, isTeacher } = useTeacherPermissions();
  const { data, isLoading, isError, isRefetching, refetch } = useTeacherGroups();
  const organizationName = useAuthStore((state) => state.organizationName);
  const logoUrl = useAuthStore((state) => state.logoUrl);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const [logoVisible, setLogoVisible] = useState(true);

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

  // Permission gate: Teacher must have mark_attendance or view_attendance_reports
  if (isTeacher && !hasAnyPermission(['mark_attendance', 'view_attendance_reports'])) {
    return <PermissionDeniedScreen permission="mark_attendance" />;
  }

  if (isLoading) {
    return <SkeletonLoader testID="teacher-group-list-skeleton" />;
  }

  if (isError && !data) {
    return (
      <ErrorState
        testID="teacher-group-list-error"
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
    <View style={styles.container} testID="teacher-group-list-screen">
      <FlatList
        testID="teacher-group-list"
        data={groups}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={() => {
          void refetch();
        }}
        contentContainerStyle={
          groups.length === 0 ? styles.emptyContent : styles.listContent
        }
        ListHeaderComponent={
          <View style={styles.orgNameContainer}>
            {logoUrl && logoVisible && (
              <Image
                source={{ uri: logoUrl }}
                style={styles.orgLogo}
                resizeMode="contain"
                onError={() => setLogoVisible(false)}
                accessible={true}
                accessibilityLabel="Organization logo"
                testID="teacher-org-logo"
              />
            )}
            {isAuthLoading ? (
              <View testID="teacher-org-skeleton">
                <SkeletonBlock
                  width="60%"
                  height={22}
                  style={styles.orgNameSkeleton}
                />
              </View>
            ) : (
              <Text style={styles.orgName} testID="teacher-org-name">
                {getDisplayName(organizationName)}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const marked = item.attendance_marked_today;
          return (
            <Pressable
              accessibilityRole="button"
              testID={`teacher-group-row-${item.id}`}
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
                testID={`teacher-group-status-${item.id}`}
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
            testID="teacher-group-list-empty"
            icon="🏫"
            title="No groups assigned"
            message="You have no groups assigned. Contact your Admin to get groups assigned to your account."
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
  orgNameContainer: {
    marginBottom: spacing.md,
  },
  orgLogo: {
    maxWidth: 120,
    maxHeight: 40,
    width: 120,
    height: 40,
    marginBottom: spacing.sm,
  },
  orgName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  orgNameSkeleton: {
    marginBottom: spacing.xs,
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
