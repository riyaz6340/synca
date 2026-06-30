/**
 * Admin API endpoint wrappers.
 *
 * Typed functions over the shared {@link apiClient} covering the admin
 * workflows: dashboard data, attendance marking, person/group management,
 * leave approval, announcements, reports, holidays, and audit logs.
 *
 * Validates: Requirements 9.1, 10.4, 11.1, 11.3, 11.5, 11.6, 12.1, 12.3, 12.5,
 * 13.1, 13.3, 13.4, 14.1, 14.4, 15.2, 15.4, 16.1, 16.3, 17.1
 */
import { apiClient } from './client';
import type {
  AttendanceRecord,
  Group,
  Person,
  BulkAttendancePayload,
  LeaveRequest,
  Announcement,
  AttendanceReport,
  Holiday,
  AuditLogEntry,
} from '@/types/models';
import type { Paginated, PaginationParams } from './portal';

// ─── Request / response shapes ───────────────────────────────────────────────

/** Result envelope returned by the bulk attendance endpoint. */
export interface BulkAttendanceResult {
  message: string;
  count: number;
  records: AttendanceRecord[];
}

/**
 * Aggregated admin dashboard summary for a single date, returned by
 * `GET /api/attendance/dashboard`.
 */
export interface AdminDashboardSummary {
  date: string;
  total_students: number;
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  present_percentage: number;
  absent_percentage: number;
  late_percentage: number;
  on_leave_percentage: number;
  pending_leave_requests: number;
  groups_not_marked: number;
}

/** Fields accepted when creating or updating a person. */
export interface PersonInput {
  name: string;
  roll_number?: string;
  admission_number?: string;
  parent_mobile?: string;
  parent_email?: string;
  gender?: string;
  date_of_birth?: string;
  guardian_name?: string;
  group_id?: string;
}

/** Fields accepted when creating or updating a group. */
export interface GroupInput {
  name: string;
  description?: string;
}

/** A group's full detail (id, name, description) together with its members. */
export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  members: Person[];
}

/** Result envelope returned when adding members to a group. */
export interface AddGroupMembersResult {
  message: string;
  added_count: number;
}

/** Fields accepted when creating an announcement. */
export interface AnnouncementInput {
  title: string;
  body: string;
  target_type: 'Organization' | 'Group' | 'Person';
  target_ids?: string[];
  scheduled_at?: string;
}

/** Fields accepted when creating a holiday. */
export interface HolidayInput {
  date: string;
  name: string;
  description?: string;
  type?: string;
}

/** Filters for generating an attendance report. */
export interface ReportParams {
  start_date: string;
  end_date: string;
  group_id?: string;
  person_id?: string;
}

/** Attendance report payload (the `report` object the backend returns). */
export interface AttendanceReportResult {
  persons: AttendanceReport[];
  [key: string]: unknown;
}

/** Filters for the audit log list. */
export interface AuditLogParams extends PaginationParams {
  entity_type?: string;
  action?: string;
}

// ─── Endpoint functions ──────────────────────────────────────────────────────

export const adminApi = {
  /**
   * Fetch the aggregated admin dashboard summary for a given date (defaults to
   * today when the caller passes today's date). Returns total students, the
   * per-status counts and percentages, pending leave request count, and the
   * number of groups not yet marked.
   * GET /api/attendance/dashboard?date=YYYY-MM-DD
   */
  async getDashboard(date: string): Promise<AdminDashboardSummary> {
    const res = await apiClient.get<AdminDashboardSummary>('/api/attendance/dashboard', {
      params: { date },
    });
    return res.data;
  },

  /**
   * List all groups (classes) with member counts and today's marking status.
   * GET /api/groups
   */
  async getGroups(): Promise<Group[]> {
    const res = await apiClient.get<{ groups: Group[] }>('/api/groups');
    return res.data.groups;
  },

  /**
   * Get the active members of a group.
   * GET /api/groups/:id  → `{ group: { members: [...] } }`
   */
  async getGroupMembers(groupId: string): Promise<Person[]> {
    const res = await apiClient.get<{ group: { members: Person[] } }>(
      `/api/groups/${groupId}`,
    );
    return res.data.group?.members ?? [];
  },

  /**
   * Get a group's full detail (name, description) together with its members.
   * GET /api/groups/:id  → `{ group: { ...group, members } }`
   */
  async getGroup(groupId: string): Promise<GroupDetail> {
    const res = await apiClient.get<{ group: GroupDetail }>(`/api/groups/${groupId}`);
    const group = res.data.group;
    return { ...group, members: group?.members ?? [] };
  },

  /**
   * Create a new group (class).
   * POST /api/groups  → `{ group }`
   */
  async createGroup(input: GroupInput): Promise<Group> {
    const res = await apiClient.post<{ group: Group }>('/api/groups', input);
    return res.data.group;
  },

  /**
   * Update an existing group's name and/or description.
   * PUT /api/groups/:id  → `{ group }`
   */
  async updateGroup(groupId: string, input: Partial<GroupInput>): Promise<Group> {
    const res = await apiClient.put<{ group: Group }>(`/api/groups/${groupId}`, input);
    return res.data.group;
  },

  /**
   * Add one or more persons to a group.
   * POST /api/groups/:id/members  body `{ person_ids }`  → `{ added_count }`
   */
  async addGroupMembers(
    groupId: string,
    personIds: string[],
  ): Promise<AddGroupMembersResult> {
    const res = await apiClient.post<AddGroupMembersResult>(
      `/api/groups/${groupId}/members`,
      { person_ids: personIds },
    );
    return res.data;
  },

  /**
   * Remove a single person from a group.
   * DELETE /api/groups/:id/members/:personId
   */
  async removeGroupMember(groupId: string, personId: string): Promise<void> {
    await apiClient.delete(`/api/groups/${groupId}/members/${personId}`);
  },

  /**
   * Submit bulk attendance for a group in a single API call.
   * POST /api/attendance/bulk
   *
   * Sends the full {@link BulkAttendancePayload} (group_id, date, and per-student
   * records). The backend upserts each student's individual presence status.
   */
  async submitBulkAttendance(
    payload: BulkAttendancePayload,
  ): Promise<BulkAttendanceResult> {
    const res = await apiClient.post<BulkAttendanceResult>(
      '/api/attendance/bulk',
      payload,
    );
    return res.data;
  },

  /**
   * List persons with pagination and optional search/filter.
   * GET /api/persons?page&limit&search&group_id
   */
  async getPersons(
    params: PaginationParams & { search?: string; group_id?: string } = {},
  ): Promise<Paginated<Person>> {
    const { page = 1, limit = 20, search, group_id } = params;
    const res = await apiClient.get<Paginated<Person>>('/api/persons', {
      params: { page, limit, search, group_id },
    });
    return res.data;
  },

  /**
   * Create a new person.
   * POST /api/persons  → `{ person }`
   */
  async createPerson(input: PersonInput): Promise<Person> {
    const res = await apiClient.post<{ person: Person }>('/api/persons', input);
    return res.data.person;
  },

  /**
   * Update an existing person.
   * PUT /api/persons/:id  → `{ person }`
   */
  async updatePerson(id: string, input: Partial<PersonInput>): Promise<Person> {
    const res = await apiClient.put<{ person: Person }>(`/api/persons/${id}`, input);
    return res.data.person;
  },

  /**
   * Deactivate (soft-delete) a person.
   * PATCH /api/persons/:id/deactivate  → `{ person }`
   */
  async deactivatePerson(id: string): Promise<Person> {
    const res = await apiClient.patch<{ person: Person }>(
      `/api/persons/${id}/deactivate`,
    );
    return res.data.person;
  },

  /**
   * List leave requests for the organization (paginated, Pending first by the
   * backend ordering).
   * GET /api/leave-requests?page&limit
   */
  async getLeaveRequests(
    params: PaginationParams = {},
  ): Promise<Paginated<LeaveRequest>> {
    const { page = 1, limit = 20 } = params;
    const res = await apiClient.get<Paginated<LeaveRequest>>('/api/leave-requests', {
      params: { page, limit },
    });
    return res.data;
  },

  /**
   * Approve a pending leave request.
   * PUT /api/leave-requests/:id/approve  → `{ leave_request }`
   */
  async approveLeave(id: string): Promise<LeaveRequest> {
    const res = await apiClient.put<{ leave_request: LeaveRequest }>(
      `/api/leave-requests/${id}/approve`,
    );
    return res.data.leave_request;
  },

  /**
   * Reject a pending leave request with a required remark.
   * PUT /api/leave-requests/:id/reject  → `{ leave_request }`
   */
  async rejectLeave(id: string, reviewComment: string): Promise<LeaveRequest> {
    const res = await apiClient.put<{ leave_request: LeaveRequest }>(
      `/api/leave-requests/${id}/reject`,
      { review_comment: reviewComment },
    );
    return res.data.leave_request;
  },

  /**
   * List announcements (reverse chronological).
   * GET /api/announcements  → `{ data }`
   */
  async getAnnouncements(): Promise<Announcement[]> {
    const res = await apiClient.get<{ data: Announcement[] }>('/api/announcements');
    return res.data.data;
  },

  /**
   * Create an announcement (draft unless scheduled/published).
   * POST /api/announcements  → the created announcement
   */
  async createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
    const res = await apiClient.post<Announcement>('/api/announcements', input);
    return res.data;
  },

  /**
   * Publish a previously-created announcement.
   * POST /api/announcements/:id/publish
   */
  async publishAnnouncement(id: string): Promise<void> {
    await apiClient.post(`/api/announcements/${id}/publish`);
  },

  /**
   * Generate an attendance report for a date range / optional group / person.
   * GET /api/reports/attendance  → `{ report }`
   */
  async getReports(params: ReportParams): Promise<AttendanceReportResult> {
    const res = await apiClient.get<{ report: AttendanceReportResult }>(
      '/api/reports/attendance',
      { params },
    );
    return res.data.report;
  },

  /**
   * Export an attendance report as a PDF. Returns the raw binary so the screen
   * can hand it to the device share sheet.
   * GET /api/reports/attendance/export?format=pdf
   */
  async exportReportPdf(params: ReportParams): Promise<ArrayBuffer> {
    const res = await apiClient.get<ArrayBuffer>('/api/reports/attendance/export', {
      params: { ...params, format: 'pdf' },
      responseType: 'arraybuffer',
    });
    return res.data;
  },

  /**
   * List holidays, optionally scoped to a year/month.
   * GET /api/holidays  → `{ holidays }`
   */
  async getHolidays(params: { year?: number; month?: number } = {}): Promise<Holiday[]> {
    const res = await apiClient.get<{ holidays: Holiday[] }>('/api/holidays', {
      params,
    });
    return res.data.holidays;
  },

  /**
   * Create a holiday.
   * POST /api/holidays  → `{ holiday }`
   */
  async createHoliday(input: HolidayInput): Promise<Holiday> {
    const res = await apiClient.post<{ holiday: Holiday }>('/api/holidays', input);
    return res.data.holiday;
  },

  /**
   * List audit log entries (most recent first). Accepts pagination/filter
   * params; the backend currently honours `limit`, `entity_type`, and `action`.
   * GET /api/audit-logs  → `{ data }`
   */
  async getAuditLogs(params: AuditLogParams = {}): Promise<AuditLogEntry[]> {
    const { page, limit = 50, entity_type, action } = params;
    const res = await apiClient.get<{ data: AuditLogEntry[] }>('/api/audit-logs', {
      params: { page, limit, entity_type, action },
    });
    return res.data.data;
  },
};

export default adminApi;
