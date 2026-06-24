import { recordAttendance } from './attendanceService';

export interface CreateLeaveAttendanceInput {
  organizationId: string;
  personId: string;
  startDate: string;
  endDate: string;
  recordedBy: string;
}

/**
 * Creates Attendance_Records with status On_Leave for each date in the given range (inclusive).
 * Uses the existing recordAttendance() upsert to avoid duplicates.
 *
 * @returns The count of records created or updated.
 */
export async function createLeaveAttendanceRecords(
  input: CreateLeaveAttendanceInput
): Promise<number> {
  const { organizationId, personId, startDate, endDate, recordedBy } = input;

  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const dateStr = current.toISOString().split('T')[0];

    await recordAttendance({
      organizationId,
      personId,
      date: dateStr,
      presenceStatus: 'On_Leave',
      recordedBy,
    });

    count++;
  }

  return count;
}
