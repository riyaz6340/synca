/**
 * ReportsScreen — the Admin "Attendance Reports" screen (task 12.5).
 *
 * Behaviour:
 *  - Renders filter controls for a date range (start/end via
 *    {@link DateRangePicker}) and an optional group selection (via
 *    {@link SearchableDropdown}, populated from {@link adminApi.getGroups})
 *    (Requirement 15.1).
 *  - When the Admin applies valid filters and taps "Generate Report", fetches
 *    report data from the Backend_API (`GET /api/reports/attendance`) via
 *    {@link adminApi.getReports} (Requirement 15.2). The fetch is on-demand:
 *    a React Query is keyed by the *applied* params and only enabled once the
 *    Admin generates a report.
 *  - Displays the report as a summary table: one row per student showing the
 *    Present / Absent / Late / On_Leave counts and the attendance percentage
 *    for the selected period (Requirement 15.3).
 *  - "Export PDF" requests the PDF from the Backend_API via
 *    {@link adminApi.exportReportPdf} and hands the bytes to the device share
 *    sheet through the {@link sharePdf} wrapper (Requirement 15.4).
 *  - Shows a {@link SkeletonLoader} while generating, an {@link ErrorState}
 *    (with retry) on failure, and an {@link EmptyState} when no rows match.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 */
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { adminApi, type ReportParams } from '@/api/admin';
import {
  DateRangePicker,
  EmptyState,
  ErrorState,
  SearchableDropdown,
  SkeletonLoader,
  colors,
  radius,
  spacing,
} from '@/components';
import { validateRange } from '@/components/DateRangePicker';
import { sharePdf, ShareUnavailableError } from '@/services/shareFile';
import type { AttendanceReport, Group } from '@/types/models';

/** React Query key for the admin groups list (filter dropdown). */
export const ADMIN_REPORT_GROUPS_QUERY_KEY = ['admin', 'report-groups'] as const;

/** Build the React Query key for a generated report from its applied params. */
export function reportQueryKey(
  params: ReportParams,
): readonly ['admin', 'report', ReportParams] {
  return ['admin', 'report', params] as const;
}

/** Sentinel option representing "all groups" (no group_id filter). */
const ALL_GROUPS: Group = {
  id: '',
  name: 'All groups',
  member_count: 0,
  attendance_marked_today: false,
};

export default function ReportsScreen() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group>(ALL_GROUPS);
  // The params actually applied when "Generate Report" was tapped. The report
  // query is keyed off / enabled by this so fetching is strictly on-demand.
  const [appliedParams, setAppliedParams] = useState<ReportParams | null>(null);

  // Populate the group filter dropdown.
  const { data: groups } = useQuery({
    queryKey: ADMIN_REPORT_GROUPS_QUERY_KEY,
    queryFn: adminApi.getGroups,
  });

  const groupOptions = useMemo<Group[]>(
    () => [ALL_GROUPS, ...(groups ?? [])],
    [groups],
  );

  const rangeError = validateRange(startDate, endDate);
  const canGenerate = Boolean(startDate) && Boolean(endDate) && !rangeError;

  const reportQuery = useQuery({
    queryKey: appliedParams ? reportQueryKey(appliedParams) : ['admin', 'report', 'idle'],
    queryFn: () => adminApi.getReports(appliedParams as ReportParams),
    enabled: appliedParams !== null,
  });

  const exportMutation = useMutation({
    mutationFn: async (params: ReportParams) => {
      const bytes = await adminApi.exportReportPdf(params);
      await sharePdf(bytes, {
        filename: `attendance-report-${params.start_date}_to_${params.end_date}.pdf`,
        dialogTitle: 'Attendance report',
      });
    },
    onError: (error) => {
      const message =
        error instanceof ShareUnavailableError
          ? error.message
          : "We couldn't export the report. Please try again.";
      Alert.alert('Export failed', message);
    },
  });

  const handleGenerate = () => {
    if (!canGenerate) {
      return;
    }
    const params: ReportParams = {
      start_date: startDate,
      end_date: endDate,
      ...(selectedGroup.id ? { group_id: selectedGroup.id } : {}),
    };
    setAppliedParams(params);
  };

  const handleExport = () => {
    if (!appliedParams) {
      return;
    }
    exportMutation.mutate(appliedParams);
  };

  const rows: AttendanceReport[] = reportQuery.data?.persons ?? [];
  const hasReport = appliedParams !== null;

  return (
    <View style={styles.container} testID="reports-screen">
      {/* ─── Filters ─────────────────────────────────────────────────── */}
      <View style={styles.filters}>
        <DateRangePicker
          testID="reports-date-range"
          startDate={startDate}
          endDate={endDate}
          onChangeStart={setStartDate}
          onChangeEnd={setEndDate}
        />

        <Text style={styles.label}>Group</Text>
        <SearchableDropdown<Group>
          testID="reports-group-dropdown"
          items={groupOptions}
          getLabel={(g) => g.name}
          getKey={(g) => g.id || 'all'}
          selected={selectedGroup}
          onSelect={setSelectedGroup}
          placeholder="All groups"
        />

        <Pressable
          accessibilityRole="button"
          testID="reports-generate"
          disabled={!canGenerate}
          style={[styles.generateBtn, !canGenerate && styles.btnDisabled]}
          onPress={handleGenerate}
        >
          <Text style={styles.generateBtnText}>Generate Report</Text>
        </Pressable>

        {hasReport && rows.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            testID="reports-export"
            disabled={exportMutation.isPending}
            style={[styles.exportBtn, exportMutation.isPending && styles.btnDisabled]}
            onPress={handleExport}
          >
            <Text style={styles.exportBtnText}>
              {exportMutation.isPending ? 'Exporting…' : 'Export PDF'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* ─── Results ─────────────────────────────────────────────────── */}
      <ReportResults
        hasReport={hasReport}
        isLoading={reportQuery.isLoading && reportQuery.fetchStatus !== 'idle'}
        isError={reportQuery.isError}
        rows={rows}
        onRetry={() => {
          void reportQuery.refetch();
        }}
      />
    </View>
  );
}

interface ReportResultsProps {
  hasReport: boolean;
  isLoading: boolean;
  isError: boolean;
  rows: AttendanceReport[];
  onRetry: () => void;
}

function ReportResults({
  hasReport,
  isLoading,
  isError,
  rows,
  onRetry,
}: ReportResultsProps) {
  if (!hasReport) {
    return (
      <EmptyState
        testID="reports-idle"
        icon="📊"
        title="No report yet"
        message="Choose a date range and group, then tap Generate Report."
      />
    );
  }

  if (isLoading) {
    return <SkeletonLoader testID="reports-skeleton" count={5} />;
  }

  if (isError) {
    return (
      <ErrorState
        testID="reports-error"
        title="Couldn't generate the report"
        message="We couldn't reach the server. Please check your connection and try again."
        onRetry={onRetry}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        testID="reports-empty"
        icon="🗒️"
        title="No records found"
        message="No attendance records were found for the selected filters."
      />
    );
  }

  return (
    <FlatList
      testID="report-table"
      data={rows}
      keyExtractor={(item) => item.person_id}
      stickyHeaderIndices={[0]}
      ListHeaderComponent={<ReportTableHeader />}
      renderItem={({ item }) => <ReportTableRow row={item} />}
      contentContainerStyle={styles.tableContent}
    />
  );
}

function ReportTableHeader() {
  return (
    <View style={[styles.row, styles.headerRow]} testID="report-table-header">
      <Text style={[styles.cell, styles.nameCell, styles.headerText]}>Student</Text>
      <Text style={[styles.cell, styles.headerText]}>P</Text>
      <Text style={[styles.cell, styles.headerText]}>A</Text>
      <Text style={[styles.cell, styles.headerText]}>L</Text>
      <Text style={[styles.cell, styles.headerText]}>OL</Text>
      <Text style={[styles.cell, styles.pctCell, styles.headerText]}>%</Text>
    </View>
  );
}

function ReportTableRow({ row }: { row: AttendanceReport }) {
  return (
    <View style={styles.row} testID={`report-row-${row.person_id}`}>
      <Text style={[styles.cell, styles.nameCell, styles.nameText]} numberOfLines={1}>
        {row.person_name}
      </Text>
      <Text style={[styles.cell, { color: colors.present }]}>{row.present_count}</Text>
      <Text style={[styles.cell, { color: colors.absent }]}>{row.absent_count}</Text>
      <Text style={[styles.cell, { color: colors.late }]}>{row.late_count}</Text>
      <Text style={[styles.cell, { color: colors.onLeave }]}>{row.on_leave_count}</Text>
      <Text
        style={[styles.cell, styles.pctCell, styles.pctText]}
        testID={`report-row-${row.person_id}-percentage`}
      >
        {row.attendance_percentage}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filters: {
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  generateBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  generateBtnText: {
    color: colors.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
  exportBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  exportBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  tableContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerRow: {
    backgroundColor: colors.surface,
  },
  cell: {
    flex: 1,
    fontSize: 13,
    textAlign: 'center',
    color: colors.text,
  },
  nameCell: {
    flex: 3,
    textAlign: 'left',
  },
  pctCell: {
    flex: 1.5,
  },
  headerText: {
    fontWeight: '700',
    color: colors.textMuted,
  },
  nameText: {
    fontWeight: '600',
    color: colors.text,
  },
  pctText: {
    fontWeight: '700',
    color: colors.text,
  },
});
