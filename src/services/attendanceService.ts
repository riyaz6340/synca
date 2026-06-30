import db from '../config/database';
import { createNotificationsForStakeholders } from './notificationService';

export interface RecordAttendanceInput {
  organizationId: string;
  personId: string;
  date: string;
  presenceStatus: string;
  recordedBy: string;
  subjectId?: string;
  periodLabel?: string;
}

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  person_id: string;
  date: string;
  time: string;
  presence_status: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Triggers notifications to all stakeholders associated with a person
 * when their presence status is Absent or Late.
 * This is non-blocking — errors are silently caught to avoid failing attendance recording.
 */
function triggerStakeholderNotifications(
  personId: string,
  organizationId: string,
  presenceStatus: string,
  date: string
): void {
  // Fire and forget — do not await
  void (async () => {
    try {
      // Look up stakeholders associated with this person
      const stakeholderRows = await db('person_stakeholders')
        .where('person_id', personId)
        .select('stakeholder_id');

      const stakeholderIds = stakeholderRows.map((row) => row.stakeholder_id);

      if (stakeholderIds.length === 0) {
        return;
      }

      // Look up the person's name
      const person = await db('persons')
        .where('id', personId)
        .select('name')
        .first();

      const personName = person?.name || 'Unknown';

      // Determine notification type and content
      const notificationType = presenceStatus === 'Absent' ? 'absence' : 'late';
      const statusLabel = presenceStatus === 'Absent' ? 'absent' : 'late';
      const title = `${personName} marked ${statusLabel}`;
      const body = `${personName} has been marked as ${statusLabel} on ${date}.`;

      await createNotificationsForStakeholders(
        stakeholderIds,
        organizationId,
        notificationType,
        title,
        body,
        { personId, personName }
      );
    } catch {
      // Silently catch errors to not fail attendance recording
    }
  })();
}

/**
 * Record attendance for a single person using an upsert pattern.
 * Always stores the recorded_by user and current submission timestamp.
 * When presence_status is Absent or Late, triggers notifications to associated stakeholders.
 */
export async function recordAttendance(input: RecordAttendanceInput): Promise<AttendanceRecord> {
  const now = new Date();
  const subjectId = input.subjectId || null;
  const periodLabel = input.periodLabel || 'Full Day';

  const [record] = await db('attendance_records')
    .insert({
      organization_id: input.organizationId,
      person_id: input.personId,
      date: input.date,
      time: now,
      presence_status: input.presenceStatus,
      recorded_by: input.recordedBy,
      subject_id: subjectId,
      period_label: periodLabel,
    })
    .onConflict(db.raw('(person_id, date, COALESCE(subject_id, \'00000000-0000-0000-0000-000000000000\'))'))
    .merge({
      presence_status: input.presenceStatus,
      time: now,
      recorded_by: input.recordedBy,
      organization_id: input.organizationId,
      period_label: periodLabel,
      updated_at: now,
    })
    .returning('*');

  // Trigger notifications for Absent or Late statuses (non-blocking)
  if (input.presenceStatus === 'Absent' || input.presenceStatus === 'Late') {
    triggerStakeholderNotifications(
      input.personId,
      input.organizationId,
      input.presenceStatus,
      input.date
    );
  }

  return record;
}

/**
 * Record attendance for multiple persons using the same upsert pattern.
 * Returns all created/updated attendance records.
 */
export async function bulkRecordAttendance(inputs: RecordAttendanceInput[]): Promise<AttendanceRecord[]> {
  const records: AttendanceRecord[] = [];

  for (const input of inputs) {
    const record = await recordAttendance(input);
    records.push(record);
  }

  return records;
}
