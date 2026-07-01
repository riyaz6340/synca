/**
 * AttendanceHistoryScreen — a Parent's view of a single child's attendance
 * history with date-range filtering, color-coded records, and a per-status
 * summary (task 9.2).
 *
 * Behavior:
 *  - The screen receives the selected child via route params
 *    (`personId`, `personName`) per {@link ParentAttendanceStackParamList}.
 *  - Attendance records are fetched from the backend
 *    `/api/portal/persons/:id/attendance` endpoint via
 *    {@link portalApi.getAttendanceHistory}, using React Query keyed by the
 *    person id plus the active date range so changing the range refetches with
 *    the new `start_date` / `end_date` params (Requirement 4.1, 4.3).
 *  - Records are listed with color-coded status indicators — green (Present),
 *    red (Absent), amber/yellow (Late), blue (On_Leave) — reusing the shared
 *    status palette (Requirement 4.2).
 *  - A summary row shows the total Present / Absent / Late / On_Leave counts
 *    for the selected period, computed by the pure
 *    {@link computeAttendanceSummary} helper (Requirement 4.4).
 *  - While loading a skeleton is shown; on error an ErrorState with retry; and
 *    when there are no records an EmptyState is rendered (Requirement 4.5).
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { portalApi } from '@/api/portal';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import {
  DateRangePicker,
  EmptyState,
  ErrorState,
  SkeletonLoader,
  colors,
  getStatusVisual,
  radius,
  spacing,
  validateRange,
} from '@/components';
import type { ParentAttendanceStackParamList } from '@/types/navigation';
import type { AttendanceRecord } from '@/types/models';
import {
  computeAttendanceSummary,
  type AttendanceSummary,
} from '@/utils/attendanceSummary';

type Props = NativeStackScreenProps<
  ParentAttendanceStackParamList,
  'AttendanceHistory'
>;

/** Format a Date as a YYYY-MM-DD string in local time. */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Default range: the first day of the current month through today. */
function defaultRange(): { start: string; end: string } {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toIsoDate(firstOfMonth), end: toIsoDate(now) };
}

/** A single summary tile (count + label) tinted with the status color. */
function SummaryTile({
  label,
  count,
  color,
  testID,
}: {
  label: string;
  count: number;
  color: string;
  testID: string;
}): React.ReactElement {
  return (
    <View style={[styles.summaryTile, { borderColor: color }]}>
      <Text style={[styles.summaryCount, { color }]} testID={testID}>
        {count}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function AttendanceSummaryRow({
  summary,
}: {
  summary: AttendanceSummary;
}): React.ReactElement {
  return (
    <View style={styles.summaryRow} testID="attendance-summary">
      <SummaryTile
        label="Present"
        count={summary.present}
        color={colors.present}
        testID="summary-present"
      />
      <SummaryTile
        label="Absent"
        count={summary.absent}
        color={colors.absent}
        testID="summary-absent"
      />
      <SummaryTile
        label="Late"
        count={summary.late}
        color={colors.late}
        testID="summary-late"
      />
      <SummaryTile
        label="On Leave"
        count={summary.on_leave}
        color={colors.onLeave}
        testID="summary-on-leave"
      />
    </View>
  );
}

/** A single attendance record row with a color-coded status indicator. */
function AttendanceRow({
  record,
}: {
  record: AttendanceRecord;
}): React.ReactElement {
  const visual = getStatusVisual(record.presence_status);
  return (
    <View style={styles.recordRow} testID={`attendance-row-${record.date}`}>
      <View style={[styles.statusDot, { backgroundColor: visual.color }]} />
      <View style={styles.recordBody}>
        <Text style={styles.recordDate}>{record.date}</Text>
        {record.time ? (
          <Text style={styles.recordTime}>{record.time}</Text>
        ) : null}
      </View>
      <Text style={[styles.recordStatus, { color: visual.color }]}>
        {visual.label}
      </Text>
    </View>
  );
}

export default function AttendanceHistoryScreen({
  route,
}: Props): React.ReactElement {
  const { personId, personName } = route.params;

  const initial = useMemo(defaultRange, []);
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);

  // Only query when both endpoints of the range are present and well-formed.
  const rangeValid =
    startDate.length > 0 &&
    endDate.length > 0 &&
    validateRange(startDate, endDate) === null;

  const {
    data: records,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['portal-attendance', personId, startDate, endDate],
    queryFn: () =>
      portalApi.getAttendanceHistory(personId, {
        start_date: startDate,
        end_date: endDate,
      }),
    enabled: rangeValid,
    staleTime: 10_000, // Refresh quickly for real-time attendance updates
  });

  // Auto-refetch when screen gains focus
  useRefetchOnFocus(['portal-attendance', personId, startDate, endDate]);

  const summary = useMemo(
    () => computeAttendanceSummary(records ?? []),
    [records]
  );

  const renderBody = (): React.ReactElement => {
    if (rangeValid && isLoading) {
      return <SkeletonLoader count={6} />;
    }
    if (isError) {
      return (
        <ErrorState
          message="We couldn't load attendance history. Please try again."
          onRetry={() => {
            void refetch();
          }}
        />
      );
    }
    if (!records || records.length === 0) {
      return (
        <EmptyState
          icon="🗓️"
          title="No records found"
          message="There are no attendance records for the selected period."
        />
      );
    }
    return (
      <FlatList
        testID="attendance-list"
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AttendanceRow record={item} />}
        ListHeaderComponent={<AttendanceSummaryRow summary={summary} />}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  return (
    <View style={styles.container} testID="attendance-history-screen">
      <Text style={styles.heading} accessibilityRole="header">
        {personName}
      </Text>
      <Text style={styles.subheading}>Attendance history</Text>

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onChangeStart={setStartDate}
        onChangeEnd={setEndDate}
      />

      <View style={styles.body}>{renderBody()}</View>
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
    marginBottom: spacing.sm,
  },
  body: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    marginRight: spacing.md,
  },
  recordBody: {
    flex: 1,
  },
  recordDate: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  recordTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  recordStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
});
