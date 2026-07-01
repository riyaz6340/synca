/**
 * AttendanceModeScreen — presents a choice between Sequential and Bulk
 * attendance marking modes before navigating to the appropriate screen.
 *
 * Route params:
 *  - groupId: the group to mark attendance for
 *  - groupName: display name for the group
 *
 * On selecting Sequential, navigates to the SequentialAttendance screen.
 * On selecting Bulk, navigates to the existing BulkMarking screen.
 *
 * Validates: Requirements 7.1
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/components';
import type {
  AdminAttendanceStackParamList,
  TeacherAttendanceStackParamList,
} from '@/types/navigation';

type AttendanceModeRouteParams = {
  AttendanceMode: { groupId: string; groupName: string };
};

type NavProp = NativeStackNavigationProp<
  TeacherAttendanceStackParamList | AdminAttendanceStackParamList,
  'AttendanceMode'
>;

export default function AttendanceModeScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<AttendanceModeRouteParams, 'AttendanceMode'>>();
  const { groupId, groupName } = route.params;

  const handleSequential = () => {
    navigation.navigate('SequentialAttendance', { groupId, groupName });
  };

  const handleBulk = () => {
    navigation.navigate('BulkMarking', { groupId, groupName });
  };

  return (
    <View style={styles.container} testID="attendance-mode-screen">
      <Text style={styles.title}>Mark Attendance</Text>
      <Text style={styles.subtitle}>{groupName}</Text>
      <Text style={styles.description}>
        Choose how you'd like to mark attendance for this group.
      </Text>

      <Pressable
        accessibilityRole="button"
        style={styles.card}
        onPress={handleSequential}
        testID="attendance-mode-sequential"
      >
        <Text style={styles.cardIcon}>👤</Text>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Sequential Mode</Text>
          <Text style={styles.cardDescription}>
            Students appear one by one in roll number order. Mark each student
            individually as Present, Absent, or Late.
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        style={styles.card}
        onPress={handleBulk}
        testID="attendance-mode-bulk"
      >
        <Text style={styles.cardIcon}>👥</Text>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Bulk Mode</Text>
          <Text style={styles.cardDescription}>
            View all students at once. Everyone starts as Present — tap to change
            status for absentees.
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardIcon: {
    fontSize: 28,
    marginRight: spacing.md,
    marginTop: spacing.xs,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
