/**
 * AttendanceCalendarScreen — Read-only monthly calendar view showing
 * attendance marking status across dates for all visible groups.
 *
 * - Admin users see all organization groups (via useAllGroups).
 * - Teacher users see only their assigned groups (via useTeacherGroups).
 * - Dates with at least one group marked display a green dot.
 * - Tapping a date opens a detail modal with per-group status.
 * - No mutation controls are rendered (read-only).
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3,
 *            4.1, 5.1, 6.1, 7.1, 9.1, 9.2, 9.3
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { useAuthStore } from '@/stores/auth';
import { useMarkedDates } from '@/hooks/useMarkedDates';
import { useTeacherGroups } from '@/hooks/useTeacherGroups';
import { useAllGroups } from '@/hooks/useAllGroups';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { ErrorState } from '@/components/ErrorState';
import { CalendarLegend } from '@/components/CalendarLegend';
import { DateDetailModal } from '@/components/DateDetailModal';
import { colors, spacing } from '@/components/theme';
import { buildMarkedDatesMap } from '@/utils/calendarUtils';
import type { Group } from '@/types/models';

/** Calendar theme overrides to match the app's design system. */
const calendarTheme = {
  backgroundColor: colors.background,
  calendarBackground: colors.background,
  textSectionTitleColor: colors.textMuted,
  todayTextColor: colors.primary,
  dayTextColor: colors.text,
  textDisabledColor: colors.border,
  arrowColor: colors.primary,
  monthTextColor: colors.text,
  textMonthFontWeight: '600' as const,
  textDayFontSize: 14,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 13,
};

export default function AttendanceCalendarScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const isTeacher = role === 'Teacher';

  // ─── State ───────────────────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ─── Group resolution based on role ──────────────────────────────────────────
  const teacherGroupsQuery = useTeacherGroups();
  const allGroupsQuery = useAllGroups({ enabled: !isTeacher });

  const groups: Group[] = isTeacher
    ? teacherGroupsQuery.data ?? []
    : allGroupsQuery.data ?? [];

  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);

  // ─── Fetch marked dates for all visible groups in current month ──────────────
  const markedDatesQuery = useMarkedDates({
    groupIds,
    year: currentMonth.year,
    month: currentMonth.month,
    enabled: groupIds.length > 0,
  });

  // ─── Build react-native-calendars markedDates object ─────────────────────────
  const calendarMarkedDates = useMemo(
    () => buildMarkedDatesMap(markedDatesQuery.data ?? {}),
    [markedDatesQuery.data],
  );

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleMonthChange = useCallback((month: DateData) => {
    setCurrentMonth({ year: month.year, month: month.month });
  }, []);

  const handleDayPress = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
  }, []);

  const handleDismissModal = useCallback(() => {
    setSelectedDate(null);
  }, []);

  // ─── Loading state ───────────────────────────────────────────────────────────
  const isInitialLoading =
    (isTeacher ? teacherGroupsQuery.isLoading : allGroupsQuery.isLoading) ||
    (groupIds.length > 0 && markedDatesQuery.isLoading);

  // ─── Error state ─────────────────────────────────────────────────────────────
  const hasError = markedDatesQuery.isError;

  if (isInitialLoading) {
    return <SkeletonLoader count={6} testID="calendar-skeleton" />;
  }

  if (hasError) {
    return (
      <ErrorState
        message="Failed to load attendance data"
        onRetry={() => markedDatesQuery.refetch()}
        testID="calendar-error"
      />
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container} testID="attendance-calendar-screen">
      <Calendar
        current={`${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`}
        onMonthChange={handleMonthChange}
        onDayPress={handleDayPress}
        markedDates={calendarMarkedDates}
        markingType="dot"
        theme={calendarTheme}
        testID="attendance-calendar"
      />
      <CalendarLegend />
      <DateDetailModal
        visible={selectedDate !== null}
        date={selectedDate}
        groups={groups}
        markedDatesByGroup={markedDatesQuery.data ?? {}}
        onDismiss={handleDismissModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
  },
});
