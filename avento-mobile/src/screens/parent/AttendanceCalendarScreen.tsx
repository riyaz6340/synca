/**
 * Parent AttendanceCalendarScreen — Shows a monthly calendar for the selected
 * child with color-coded attendance marks (green = Present, red = Absent,
 * amber = Late, blue = On Leave).
 *
 * Flow: Parent selects a child from the list → navigates here with personId/personName.
 * The calendar shows the current month by default. Tapping a date shows that day's status.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Calendar, type DateData } from 'react-native-calendars';

import { portalApi } from '@/api/portal';
import { ErrorState, SkeletonLoader, colors, spacing, radius } from '@/components';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import type { ParentAttendanceStackParamList } from '@/types/navigation';

type Props = NativeStackScreenProps<ParentAttendanceStackParamList, 'AttendanceCalendar'>;

interface AttendanceRecord {
  date: string;
  presence_status: string;
  time?: string;
  subject_name?: string;
  period_label?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Present: '#22c55e',
  Absent: '#ef4444',
  Late: '#f59e0b',
  On_Leave: '#3b82f6',
};

const STATUS_LABELS: Record<string, string> = {
  Present: 'Present',
  Absent: 'Absent',
  Late: 'Late',
  On_Leave: 'On Leave',
};

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export default function AttendanceCalendarScreen({ route }: Props): React.ReactElement {
  const { personId, personName } = route.params;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { start, end } = useMemo(() => getMonthRange(year, month), [year, month]);

  const queryKey = ['parent-calendar', personId, start, end];

  const { data: records, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => portalApi.getAttendanceHistory(personId, { start_date: start, end_date: end }),
  });

  useRefetchOnFocus(queryKey);

  // Build marked dates for the calendar
  const markedDates = useMemo(() => {
    if (!records || records.length === 0) return {};
    const marks: Record<string, { marked: boolean; dotColor: string; selectedColor?: string; selected?: boolean }> = {};
    for (const rec of records as AttendanceRecord[]) {
      const color = STATUS_COLORS[rec.presence_status] || '#94a3b8';
      marks[rec.date] = {
        marked: true,
        dotColor: color,
        ...(rec.date === selectedDate ? { selected: true, selectedColor: color + '30' } : {}),
      };
    }
    if (selectedDate && !marks[selectedDate]) {
      marks[selectedDate] = { marked: false, dotColor: '#94a3b8', selected: true, selectedColor: '#e2e8f0' };
    }
    return marks;
  }, [records, selectedDate]);

  // Get selected date's record
  const selectedRecord = useMemo(() => {
    if (!selectedDate || !records) return null;
    return (records as AttendanceRecord[]).find(r => r.date === selectedDate) || null;
  }, [records, selectedDate]);

  const onMonthChange = (monthData: DateData) => {
    setYear(monthData.year);
    setMonth(monthData.month);
    setSelectedDate(null);
  };

  if (isLoading) {
    return <SkeletonLoader count={8} testID="calendar-skeleton" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load attendance"
        message="Please check your connection and try again."
        onRetry={() => { void refetch(); }}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.childName}>{personName}'s Attendance</Text>

      <Calendar
        markingType="dot"
        markedDates={markedDates}
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        onMonthChange={onMonthChange}
        theme={{
          todayTextColor: colors.primary,
          arrowColor: colors.primary,
          dotColor: colors.primary,
          selectedDayBackgroundColor: colors.primary,
        }}
        testID="parent-attendance-calendar"
      />

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.legendText}>Present</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Absent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.legendText}>Late</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.legendText}>On Leave</Text>
        </View>
      </View>

      {/* Selected date detail */}
      {selectedDate && (
        <View style={styles.detailCard}>
          <Text style={styles.detailDate}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          {selectedRecord ? (
            <View style={styles.detailRow}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[selectedRecord.presence_status] || '#94a3b8' }]} />
              <Text style={styles.detailStatus}>
                {STATUS_LABELS[selectedRecord.presence_status] || selectedRecord.presence_status}
              </Text>
              {selectedRecord.time && (
                <Text style={styles.detailTime}>at {selectedRecord.time}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.detailNone}>No attendance recorded</Text>
          )}
        </View>
      )}

      {/* Monthly summary */}
      {records && (records as AttendanceRecord[]).length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Monthly Summary</Text>
          <View style={styles.summaryGrid}>
            <SummaryItem label="Present" count={(records as AttendanceRecord[]).filter(r => r.presence_status === 'Present').length} color="#22c55e" />
            <SummaryItem label="Absent" count={(records as AttendanceRecord[]).filter(r => r.presence_status === 'Absent').length} color="#ef4444" />
            <SummaryItem label="Late" count={(records as AttendanceRecord[]).filter(r => r.presence_status === 'Late').length} color="#f59e0b" />
            <SummaryItem label="On Leave" count={(records as AttendanceRecord[]).filter(r => r.presence_status === 'On_Leave').length} color="#3b82f6" />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function SummaryItem({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  childName: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textMuted },
  detailCard: { marginTop: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  detailDate: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  detailStatus: { fontSize: 15, fontWeight: '600', color: colors.text },
  detailTime: { fontSize: 13, color: colors.textMuted },
  detailNone: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  summaryCard: { marginTop: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryCount: { fontSize: 22, fontWeight: '700' },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
});
