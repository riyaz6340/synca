/**
 * SequentialAttendanceScreen — displays one student at a time for attendance
 * marking in roll-number order. Supports Previous/Next navigation, three
 * status buttons (Present, Absent, Late), a progress indicator, and
 * auto-advance after marking.
 *
 * Route params:
 *  - groupId: the group to mark attendance for
 *  - groupName: display name for the group
 *
 * Fetches members from GET /api/attendance/group/:groupId/members (sorted
 * by roll_number ascending, nulls last alphabetical).
 *
 * When all students are marked, navigates to the AttendanceSummary screen.
 * If the group has zero members, shows an EmptyState.
 *
 * Validates: Requirements 5.1, 5.2, 5.4, 5.5, 5.7, 12.3
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, spacing, EmptyState } from '@/components';
import { apiClient } from '@/api/client';
import type {
  AdminAttendanceStackParamList,
  TeacherAttendanceStackParamList,
} from '@/types/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

type AttendanceStatus = 'Present' | 'Absent' | 'Late';

interface GroupMember {
  person_id: string;
  name: string;
  roll_number: number | null;
  photo_url: string | null;
}

type RouteParams = {
  SequentialAttendance: {
    groupId: string;
    groupName: string;
    periodLabel?: string;
    subjectId?: string;
  };
};

type NavProp = NativeStackNavigationProp<
  TeacherAttendanceStackParamList | AdminAttendanceStackParamList,
  'SequentialAttendance'
>;

// ─── Component ───────────────────────────────────────────────────────────────

export default function SequentialAttendanceScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RouteParams, 'SequentialAttendance'>>();
  const { groupId, groupName, periodLabel, subjectId } = route.params;

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [marks, setMarks] = useState<Map<string, AttendanceStatus>>(new Map());
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch group members on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchMembers() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get<{ members: GroupMember[] }>(
          `/api/attendance/group/${groupId}/members`,
        );
        if (!cancelled) {
          setMembers(res.data.members ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load group members');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Cleanup auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  const currentMember = members[currentIndex] ?? null;

  const handleMark = useCallback(
    (status: AttendanceStatus) => {
      if (!currentMember) return;

      const updatedMarks = new Map(marks);
      updatedMarks.set(currentMember.person_id, status);
      setMarks(updatedMarks);

      // Check if all students are now marked
      const allMarked = members.every((m) => updatedMarks.has(m.person_id));

      if (allMarked) {
        // Navigate to summary after brief delay
        autoAdvanceTimer.current = setTimeout(() => {
          const marksObj: Record<string, AttendanceStatus> = {};
          updatedMarks.forEach((v, k) => {
            marksObj[k] = v;
          });
          navigation.navigate('AttendanceSummary', {
            groupId,
            groupName,
            marks: JSON.stringify(marksObj),
            periodLabel: periodLabel ?? undefined,
            subjectId: subjectId ?? undefined,
          });
        }, 300);
      } else if (currentIndex < members.length - 1) {
        // Auto-advance to next student within 300ms
        autoAdvanceTimer.current = setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
        }, 300);
      }
    },
    [currentMember, marks, members, currentIndex, navigation, groupId, groupName],
  );

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < members.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, members.length]);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered} testID="sequential-attendance-loading">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading students…</Text>
      </View>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <View style={styles.centered} testID="sequential-attendance-error">
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            setError(null);
            apiClient
              .get<{ members: GroupMember[] }>(
                `/api/attendance/group/${groupId}/members`,
              )
              .then((res) => setMembers(res.data.members ?? []))
              .catch((err) => setError(err?.message ?? 'Failed to load'))
              .finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Empty group ───────────────────────────────────────────────────────────

  if (members.length === 0) {
    return (
      <EmptyState
        testID="sequential-attendance-empty"
        icon="📋"
        title="No Students"
        message="No students available"
        actionLabel="Go Back"
        onAction={() => navigation.goBack()}
      />
    );
  }

  // ─── Main attendance marking UI ────────────────────────────────────────────

  const progressText = `${currentIndex + 1} of ${members.length}`;
  const progressFraction = (currentIndex + 1) / members.length;
  const currentStatus = currentMember
    ? marks.get(currentMember.person_id) ?? null
    : null;

  return (
    <View style={styles.container} testID="sequential-attendance-screen">
      {/* Progress indicator */}
      <View style={styles.progressSection}>
        <Text style={styles.progressText} testID="sequential-attendance-progress">
          {progressText}
        </Text>
        {periodLabel && (
          <Text style={styles.periodIndicator}>
            {periodLabel}
          </Text>
        )}
        <View style={styles.progressBarBg}>
          <View
            style={[styles.progressBarFill, { width: `${progressFraction * 100}%` }]}
          />
        </View>
      </View>

      {/* Student card */}
      <View style={styles.studentCard} testID="sequential-attendance-card">
        {/* Photo placeholder */}
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoInitial}>
            {currentMember?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>

        <Text style={styles.studentName} testID="sequential-attendance-name">
          {currentMember?.name ?? ''}
        </Text>

        {currentMember?.roll_number != null && (
          <Text style={styles.rollNumber} testID="sequential-attendance-roll">
            Roll #{currentMember.roll_number}
          </Text>
        )}

        {/* Current status indicator */}
        {currentStatus && (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  currentStatus === 'Present'
                    ? colors.present
                    : currentStatus === 'Absent'
                      ? colors.absent
                      : colors.late,
              },
            ]}
          >
            <Text style={styles.statusBadgeText}>{currentStatus}</Text>
          </View>
        )}
      </View>

      {/* Status buttons */}
      <View style={styles.statusButtons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark Present"
          style={[
            styles.statusButton,
            styles.presentButton,
            currentStatus === 'Present' && styles.activeStatusButton,
          ]}
          onPress={() => handleMark('Present')}
          testID="sequential-attendance-present"
        >
          <Text style={styles.statusButtonText}>Present</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark Absent"
          style={[
            styles.statusButton,
            styles.absentButton,
            currentStatus === 'Absent' && styles.activeStatusButton,
          ]}
          onPress={() => handleMark('Absent')}
          testID="sequential-attendance-absent"
        >
          <Text style={styles.statusButtonText}>Absent</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark Late"
          style={[
            styles.statusButton,
            styles.lateButton,
            currentStatus === 'Late' && styles.activeStatusButton,
          ]}
          onPress={() => handleMark('Late')}
          testID="sequential-attendance-late"
        >
          <Text style={styles.statusButtonText}>Late</Text>
        </Pressable>
      </View>

      {/* Navigation buttons */}
      <View style={styles.navButtons}>
        <Pressable
          accessibilityRole="button"
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrevious}
          disabled={currentIndex === 0}
          testID="sequential-attendance-previous"
        >
          <Text
            style={[
              styles.navButtonText,
              currentIndex === 0 && styles.navButtonTextDisabled,
            ]}
          >
            ← Previous
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={[
            styles.navButton,
            currentIndex === members.length - 1 && styles.navButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={currentIndex === members.length - 1}
          testID="sequential-attendance-next"
        >
          <Text
            style={[
              styles.navButtonText,
              currentIndex === members.length - 1 && styles.navButtonTextDisabled,
            ]}
          >
            Next →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 14,
  },

  // Progress
  progressSection: {
    marginBottom: spacing.xl,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  periodIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },

  // Student card
  studentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  photoInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primaryText,
  },
  studentName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  rollNumber: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Status buttons
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  statusButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentButton: {
    backgroundColor: colors.present,
  },
  absentButton: {
    backgroundColor: colors.absent,
  },
  lateButton: {
    backgroundColor: colors.late,
  },
  activeStatusButton: {
    opacity: 0.7,
    borderWidth: 3,
    borderColor: colors.text,
  },
  statusButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Navigation buttons
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  navButtonTextDisabled: {
    color: colors.textMuted,
  },
});
