/**
 * Domain models for the Arixx mobile app.
 * Reuses the same API contracts as the parent-app PWA and frontend admin dashboard.
 * Validates: Requirements 2.1, 2.2, 2.3, 10.4
 */

// ─── Core Types ──────────────────────────────────────────────────────────────

/** Presence status enum */
export type PresenceStatus = 'Present' | 'Absent' | 'Late' | 'On_Leave';

/** Display presence status includes "Not yet marked" for UI */
export type DisplayPresenceStatus = PresenceStatus | 'Not yet marked';

/** Organization entity (tenant) */
export interface Organization {
  id: string;
  name: string;
}

// ─── Parent Domain Models ────────────────────────────────────────────────────

export interface PersonWithStatus {
  id: string;
  name: string;
  current_status: { presence_status: PresenceStatus; time: string } | null;
}

export interface AttendanceRecord {
  id: string;
  date: string;           // YYYY-MM-DD
  time: string | null;
  presence_status: PresenceStatus;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  published_at: string;   // ISO timestamp
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  sent_at: string | null;
  created_at: string;     // ISO timestamp
}

export interface LeaveRequest {
  id: string;
  person_id: string;
  person_name?: string;
  start_date: string;     // YYYY-MM-DD
  end_date: string;       // YYYY-MM-DD
  reason: string;
  leave_type?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  remarks?: string;
  created_at?: string;    // ISO timestamp — submission date
}

// ─── Admin Domain Models ─────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  attendance_marked_today: boolean;
}

export interface Person {
  id: string;
  name: string;
  roll_number?: string;
  admission_number?: string;
  parent_mobile?: string;
  parent_email?: string;
  gender?: string;
  date_of_birth?: string;
  guardian_name?: string;
  group_id?: string;
  group_name?: string;
  is_active: boolean;
}

export interface BulkAttendancePayload {
  group_id: string;
  date: string;           // YYYY-MM-DD
  records: Array<{
    person_id: string;
    presence_status: PresenceStatus;
  }>;
}

export interface Holiday {
  id: string;
  date: string;           // YYYY-MM-DD
  name: string;
  description?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_email: string;
  timestamp: string;      // ISO timestamp
}

export interface AttendanceReport {
  person_id: string;
  person_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  on_leave_count: number;
  total_days: number;
  attendance_percentage: number;
}

// ─── SuperAdmin Domain Models ────────────────────────────────────────────────

export interface PlatformStats {
  total_organizations: number;
  total_users: number;
  total_persons: number;
  today_present: number;
  today_absent: number;
  today_late: number;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  plan_type: string;
  user_count: number;
  person_count: number;
  created_at: string;
}
