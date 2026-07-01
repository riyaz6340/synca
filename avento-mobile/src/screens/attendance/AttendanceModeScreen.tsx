/**
 * AttendanceModeScreen — presents period/subject selection then a choice
 * between Sequential and Bulk attendance marking modes.
 *
 * Route params:
 *  - groupId: the group to mark attendance for
 *  - groupName: display name for the group
 *
 * Flow:
 *  1. Select "Full Day" or a specific period/subject (fetched from backend)
 *  2. Choose Sequential or Bulk mode
 *  3. Navigate with groupId, groupName, periodLabel, and subjectId
 *
 * Validates: Requirements 7.1
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { adminApi } from '@/api/admin';
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

interface Subject {
  id: string;
  name: string;
  period_number?: number;
  teacher_name?: string;
}

export default function AttendanceModeScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<AttendanceModeRouteParams, 'AttendanceMode'>>();
  const { groupId, groupName } = route.params;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'full_day' | string>('full_day');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Fetch subjects for this group
  useEffect(() => {
    let cancelled = false;
    setLoadingSubjects(true);
    adminApi.getSubjects(groupId)
      .then((data) => {
        if (!cancelled) setSubjects(data);
      })
      .catch(() => {
        if (!cancelled) setSubjects([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSubjects(false);
      });
    return () => { cancelled = true; };
  }, [groupId]);

  const handleSelectPeriod = (period: 'full_day' | string, subjectId: string | null) => {
    setSelectedPeriod(period);
    setSelectedSubjectId(subjectId);
  };

  const periodLabel = selectedPeriod === 'full_day'
    ? 'Full Day'
    : subjects.find(s => s.id === selectedSubjectId)?.name ?? selectedPeriod;

  const handleSequential = () => {
    (navigation as any).navigate('SequentialAttendance', {
      groupId,
      groupName,
      periodLabel,
      subjectId: selectedSubjectId,
    });
  };

  const handleBulk = () => {
    (navigation as any).navigate('BulkMarking', {
      groupId,
      groupName,
      periodLabel,
      subjectId: selectedSubjectId,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="attendance-mode-screen">
      <Text style={styles.title}>Mark Attendance</Text>
      <Text style={styles.subtitle}>{groupName}</Text>

      {/* Period/Subject Selection */}
      <Text style={styles.sectionTitle}>Select Period</Text>

      {loadingSubjects ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : (
        <View style={styles.periodList}>
          {/* Full Day option */}
          <Pressable
            accessibilityRole="button"
            style={[
              styles.periodChip,
              selectedPeriod === 'full_day' && styles.periodChipActive,
            ]}
            onPress={() => handleSelectPeriod('full_day', null)}
            testID="period-full-day"
          >
            <Text style={[
              styles.periodChipText,
              selectedPeriod === 'full_day' && styles.periodChipTextActive,
            ]}>
              📅 Full Day
            </Text>
          </Pressable>

          {/* Subject/Period options */}
          {subjects.map((subject) => (
            <Pressable
              key={subject.id}
              accessibilityRole="button"
              style={[
                styles.periodChip,
                selectedSubjectId === subject.id && styles.periodChipActive,
              ]}
              onPress={() => handleSelectPeriod(
                `Period ${subject.period_number ?? ''}`,
                subject.id,
              )}
              testID={`period-subject-${subject.id}`}
            >
              <Text style={[
                styles.periodChipText,
                selectedSubjectId === subject.id && styles.periodChipTextActive,
              ]}>
                {subject.period_number ? `P${subject.period_number}: ` : ''}
                {subject.name}
              </Text>
            </Pressable>
          ))}

          {subjects.length === 0 && !loadingSubjects && (
            <Text style={styles.noSubjects}>
              No subjects configured for this class. Marking as Full Day.
            </Text>
          )}
        </View>
      )}

      {/* Mode Selection */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Choose Mode</Text>

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

      {/* Selected period indicator */}
      <View style={styles.selectedInfo}>
        <Text style={styles.selectedInfoText}>
          Marking for: <Text style={styles.selectedInfoBold}>{periodLabel}</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xl * 2,
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  periodList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  periodChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  periodChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  periodChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  periodChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  noSubjects: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
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
  selectedInfo: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary + '10',
    borderRadius: radius.md,
    alignItems: 'center',
  },
  selectedInfoText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  selectedInfoBold: {
    fontWeight: '700',
    color: colors.primary,
  },
});
