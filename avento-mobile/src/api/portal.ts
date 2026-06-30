/**
 * Parent/Stakeholder ("portal") API endpoint wrappers.
 *
 * Thin, typed functions over the shared {@link apiClient}. Each returns an
 * already-normalized domain model (the backend wraps collections in a named
 * key such as `{ persons: [...] }` or paginates with `{ data, pagination }`).
 *
 * Endpoints map 1:1 to the existing backend consumed by the parent-app PWA.
 *
 * Validates: Requirements 3.1, 4.1, 5.1, 6.1, 6.3, 7.1
 */
import { apiClient } from './client';
import type {
  PersonWithStatus,
  AttendanceRecord,
  Announcement,
  Notification,
  LeaveRequest,
} from '@/types/models';

// ─── Shared helper types (re-used by admin / superadmin modules) ─────────────

/** Pagination metadata returned alongside paginated collections. */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** A paginated response envelope: `{ data, pagination }`. */
export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

/** Query params accepted by paginated list endpoints. */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/** Inclusive date range filter (YYYY-MM-DD). */
export interface DateRange {
  start_date: string;
  end_date: string;
}

/** Payload for submitting a new leave request. */
export interface LeaveSubmitInput {
  person_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type?: string;
}

// ─── Endpoint functions ──────────────────────────────────────────────────────

export const portalApi = {
  /**
   * Get the authenticated parent's children with today's presence status.
   * GET /api/portal/persons
   */
  async getPersons(): Promise<PersonWithStatus[]> {
    const res = await apiClient.get<{ persons: PersonWithStatus[] }>('/api/portal/persons');
    return res.data.persons;
  },

  /**
   * Get a child's attendance history within a date range.
   * GET /api/portal/persons/:id/attendance?start_date&end_date
   */
  async getAttendanceHistory(
    personId: string,
    range: DateRange,
  ): Promise<AttendanceRecord[]> {
    const res = await apiClient.get<{ attendance: AttendanceRecord[] }>(
      `/api/portal/persons/${personId}/attendance`,
      { params: { start_date: range.start_date, end_date: range.end_date } },
    );
    return res.data.attendance;
  },

  /**
   * Get announcements targeted at the parent's children.
   * GET /api/portal/announcements
   */
  async getAnnouncements(): Promise<Announcement[]> {
    const res = await apiClient.get<{ announcements: Announcement[] }>(
      '/api/portal/announcements',
    );
    return res.data.announcements;
  },

  /**
   * Get the parent's notifications (reverse chronological, paginated).
   * GET /api/portal/notifications?page&limit
   */
  async getNotifications(
    params: PaginationParams = {},
  ): Promise<Paginated<Notification>> {
    const { page = 1, limit = 20 } = params;
    const res = await apiClient.get<Paginated<Notification>>(
      '/api/portal/notifications',
      { params: { page, limit } },
    );
    return res.data;
  },

  /**
   * Submit a new leave request.
   * POST /api/leave-requests
   */
  async submitLeaveRequest(input: LeaveSubmitInput): Promise<LeaveRequest> {
    const res = await apiClient.post<{ leave_request: LeaveRequest }>(
      '/api/leave-requests',
      input,
    );
    return res.data.leave_request;
  },

  /**
   * List the parent's leave requests (paginated).
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
};

export default portalApi;
