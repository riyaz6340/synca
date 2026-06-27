/**
 * TypeScript data models and interfaces for the parent-app.
 * These types model existing backend responses — no new backend fields are introduced.
 */

// --- Presence ---

export type PresenceStatus = 'Present' | 'Absent' | 'Late' | 'On_Leave';

export type DisplayPresenceStatus = PresenceStatus | 'Not yet marked';

// --- Users & Organizations ---

export interface ParentUser {
  id: string;
  email: string;
  role: 'Stakeholder';
  organization_id: string;
}

export interface Organization {
  id: string;
  name: string;
}

// --- Persons ---

export interface PersonWithStatus {
  id: string;
  name: string;
  current_status: { presence_status: PresenceStatus; time: string } | null;
}

// --- Attendance ---

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  presence_status: PresenceStatus;
}

// --- Announcements ---

export interface Announcement {
  id: string;
  title: string;
  body: string;
  published_at: string; // ISO timestamp
}

// --- Notifications ---

export interface Notification {
  id: string;
  title: string;
  body: string;
  sent_at: string | null;
  created_at: string; // ISO timestamp
}

// --- Leave Requests ---

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string;
  person_id: string;
  person_name?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  reason: string;
  status: LeaveStatus;
}

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface LeaveSubmitInput {
  person_id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

// --- Pagination ---

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --- Auth ---

export interface LoginInput {
  email: string;
  password: string;
  organization_name: string;
}

export interface LoginResponse {
  token: string;
  user: ParentUser;
}

// --- View State ---

export type ViewState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; message: string };
