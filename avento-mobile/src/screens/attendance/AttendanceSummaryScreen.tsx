/**
 * AttendanceSummaryScreen — displays a summary of marked attendance statuses
 * (Present, Absent, Late counts) and allows the user to confirm & submit all
 * records as a single bulk operation.
 *
 * Route params:
 *  - groupId: the group being marked
 *  - groupName: display name for the group
 *  - marks: JSON string of { person_id: 'Present' | 'Absent' | 'Late' }
 *
 * On confirm: calls POST /api/attendance/bulk with { group_id, date, records }.
 * On success: shows a success state and navigates back.
 * On failure: retains all marks, shows error message, and offers a retry button.
 *
 * Validates: Requirements 5.3, 5.6, 5.8
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/components';
import { apiClient } from '@/api/client';
import type {
  AdminAttendanceStackParamList,
  TeacherAttendanceStackParamList,
} from '@/types/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────

type AttendanceStatus = 'Present' | 'Absent' | 'Late';

type RouteParams = {
  AttendanceSummary: {
    groupId: string;
    groupName: string;
    marks: string;
    periodLabel?: string;
    subjectId?: string;
  };
};

type NavProp = NativeStackNavigationProp<
  TeacherAttendanceStackParamList | AdminAttendanceStackParamList,
  'AttendanceSummary'
>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AttendanceSummaryScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RouteParams, 'AttendanceSummary'>>();
  const { groupId, groupName, marks: marksJson, periodLabel, subjectId } = route.params;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Parse marks from JSON route param
  const marksMap: Record<string, AttendanceStatus> = useMemo(() => {
    try {
      return JSON.parse(marksJson) as Record<string, AttendanceStatus>;
    } catch {
      return {};
    }
  }, [marksJson]);

  // Compute summary counts
  const { presentCount, absentCount, lateCount, total } = useMemo(() => {
    const entries = Object.values(marksMap);
    return {
      presentCount: entries.filter((s) => s === 'Present').length,
      absentCount: entries.filter((s) => s === 'Absent').length,
      lateCount: entries.filter((s) => s === 'Late').length,
      total: entries.length,
    };
  }, [marksMap]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const date = getTodayDate();
      const records = Object.entries(marksMap).map(([person_id, status]) => ({
        person_id,
        presence_status: status,
      }));

      await apiClient.post('/api/attendance/bulk', {
        group_id: groupId,
        date,
        records,
        ...(subjectId ? { subject_id: subjectId } : {}),
        ...(periodLabel ? { period_label: periodLabel } : {}),
      });

      setSuccess(true);

      // Navigate back after a short delay to show success state
      setTimeout(() => {
        navigation.popToTop();
      }, 1500);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ??
        err?.message ??
        'Failed to submit attendance. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [marksMap, groupId, subjectId, periodLabel, navigation]);

  // ─── Success state ─────────────────────────────────────────────────────────

  if (success) {
    return (
      <View style={styles.centered} testID="attendance-summary-success">
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Attendance Submitted</Text>
        <Text style={styles.successMessage}>
          Successfully recorded attendance for {groupName}.
        </Text>
      </View>
    );
  }

  // ─── Main summary UI ──────────────────────────────────────────────────────

  return (
    <View style={styles.container} testID="attendance-summary-screen">
      {/* Header */}
      <Text style={styles.title}>Attendance Summary</Text>
      <Text style={styles.subtitle}>{groupName}</Text>

      {/* Summary cards */}
      <View style={styles.summaryCards}>
        <View style={[styles.summaryCard, styles.presentCard]}>
          <Text style={styles.cardCount} testID="attendance-summary-present-count">
            {presentCount}
          </Text>
          <Text style={styles.cardLabel}>Present</Text>
        </View>

        <View style={[styles.summaryCard, styles.absentCard]}>
          <Text style={styles.cardCount} testID="attendance-summary-absent-count">
            {absentCount}
          </Text>
          <Text style={styles.cardLabel}>Absent</Text>
        </View>

        <View style={[styles.summaryCard, styles.lateCard]}>
          <Text style={styles.cardCount} testID="attendance-summary-late-count">
            {lateCount}
          </Text>
          <Text style={styles.cardLabel}>Late</Text>
        </View>
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Students</Text>
        <Text style={styles.totalValue} testID="attendance-summary-total">
          {total}
        </Text>
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer} testID="attendance-summary-error">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry submission"
            style={[styles.submitButton, styles.retryButton]}
            onPress={handleSubmit}
            disabled={submitting}
            testID="attendance-summary-retry"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Retry</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm and submit attendance"
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={submitting}
            testID="attendance-summary-submit"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Confirm &amp; Submit</Text>
            )}
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to edit"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={submitting}
          testID="attendance-summary-back"
        >
          <Text style={styles.backButtonText}>← Go Back to Edit</Text>
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

  // Header
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  // Summary cards
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentCard: {
    backgroundColor: colors.present,
  },
  absentCard: {
    backgroundColor: colors.absent,
  },
  lateCard: {
    backgroundColor: colors.late,
  },
  cardCount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },

  // Total row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },

  // Error
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },

  // Action buttons
  actions: {
    marginTop: 'auto' as any,
    gap: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  retryButton: {
    backgroundColor: colors.warning,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  // Success state
  successIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successMessage: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
