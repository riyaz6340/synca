import db from '../config/database';

// --- Interfaces ---

export interface ReportInput {
  organizationId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  groupId?: string;
  personId?: string;
}

export interface PersonReport {
  personId: string;
  personName: string;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysOnLeave: number;
  attendancePercentage: number;
}

export interface ReportSummary {
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysOnLeave: number;
  attendancePercentage: number;
}

export interface ReportOutput {
  totalDays: number;
  summary: ReportSummary;
  persons: PersonReport[];
}

// --- Helper Functions ---

/**
 * Count the number of weekdays (Monday–Friday) between two dates, inclusive.
 */
export function countWeekdays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return 0;
  }

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const day = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calculate attendance percentage using the design formula:
 * attendance_percentage = ((days_present + days_late) / (total_days - days_on_leave)) * 100
 *
 * Returns 0 if the denominator is zero (all days are on leave).
 */
function calculateAttendancePercentage(
  daysPresent: number,
  daysLate: number,
  totalDays: number,
  daysOnLeave: number
): number {
  const denominator = totalDays - daysOnLeave;
  if (denominator <= 0) {
    return 0;
  }
  return ((daysPresent + daysLate) / denominator) * 100;
}

// --- Main Report Generation ---

/**
 * Generate an attendance report for a given date range, optionally filtered
 * by group or person. Returns per-person breakdowns and an overall summary.
 */
export async function generateAttendanceReport(input: ReportInput): Promise<ReportOutput> {
  const { organizationId, startDate, endDate, groupId, personId } = input;

  // Step 1: Calculate total weekdays in range
  const totalDays = countWeekdays(startDate, endDate);

  // Step 2: Build query for attendance records
  let query = db('attendance_records')
    .where('attendance_records.organization_id', organizationId)
    .whereBetween('attendance_records.date', [startDate, endDate]);

  // Filter by specific person
  if (personId) {
    query = query.where('attendance_records.person_id', personId);
  }

  // Filter by group (join through person_groups)
  if (groupId) {
    query = query
      .join('person_groups', 'attendance_records.person_id', 'person_groups.person_id')
      .where('person_groups.group_id', groupId);
  }

  // Select needed fields
  const records = await query.select(
    'attendance_records.person_id',
    'attendance_records.presence_status'
  );

  // Step 3: Get person names for all person IDs in the results
  const personIds = [...new Set(records.map((r) => r.person_id))];

  let personNameMap: Record<string, string> = {};
  if (personIds.length > 0) {
    const persons = await db('persons')
      .whereIn('id', personIds)
      .select('id', 'name');
    personNameMap = Object.fromEntries(persons.map((p) => [p.id, p.name]));
  }

  // Step 4: Aggregate per person
  const personAggregates: Record<string, { present: number; absent: number; late: number; onLeave: number }> = {};

  for (const record of records) {
    const pid = record.person_id;
    if (!personAggregates[pid]) {
      personAggregates[pid] = { present: 0, absent: 0, late: 0, onLeave: 0 };
    }

    switch (record.presence_status) {
      case 'Present':
        personAggregates[pid].present++;
        break;
      case 'Absent':
        personAggregates[pid].absent++;
        break;
      case 'Late':
        personAggregates[pid].late++;
        break;
      case 'On_Leave':
        personAggregates[pid].onLeave++;
        break;
    }
  }

  // Step 5: Build per-person report
  const persons: PersonReport[] = personIds.map((pid) => {
    const agg = personAggregates[pid] || { present: 0, absent: 0, late: 0, onLeave: 0 };
    const attendancePercentage = calculateAttendancePercentage(
      agg.present,
      agg.late,
      totalDays,
      agg.onLeave
    );

    return {
      personId: pid,
      personName: personNameMap[pid] || 'Unknown',
      daysPresent: agg.present,
      daysAbsent: agg.absent,
      daysLate: agg.late,
      daysOnLeave: agg.onLeave,
      attendancePercentage: Math.round(attendancePercentage * 100) / 100,
    };
  });

  // Step 6: Calculate overall summary (aggregated across all persons)
  const summaryTotals = persons.reduce(
    (acc, p) => {
      acc.daysPresent += p.daysPresent;
      acc.daysAbsent += p.daysAbsent;
      acc.daysLate += p.daysLate;
      acc.daysOnLeave += p.daysOnLeave;
      return acc;
    },
    { daysPresent: 0, daysAbsent: 0, daysLate: 0, daysOnLeave: 0 }
  );

  const totalPersonDays = totalDays * persons.length;
  const overallPercentage = calculateAttendancePercentage(
    summaryTotals.daysPresent,
    summaryTotals.daysLate,
    totalPersonDays,
    summaryTotals.daysOnLeave
  );

  const summary: ReportSummary = {
    ...summaryTotals,
    attendancePercentage: Math.round(overallPercentage * 100) / 100,
  };

  return {
    totalDays,
    summary,
    persons,
  };
}
