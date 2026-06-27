/**
 * Typed endpoint wrappers — the only way the app talks to the backend.
 * Each wrapper sets the appropriate per-call timeout and returns
 * already-normalized domain objects.
 *
 * Validates: Requirements 2.1, 3.1, 4.1, 4.2, 5.1, 6.1, 7.1, 7.5
 */

import apiClient, {
  TIMEOUT_PRESENCE,
  TIMEOUT_MEDIUM,
  TIMEOUT_DEFAULT,
} from './client';
import type {
  LoginInput,
  LoginResponse,
  Organization,
  PersonWithStatus,
  AttendanceRecord,
  Notification,
  Pagination,
  Announcement,
  LeaveRequest,
  LeaveSubmitInput,
  DateRange,
} from './types';

// ---------------------------------------------------------------------------
// Paginated response helper type
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export const authApi = {
  /** Authenticate with email, password, and organization name. */
  async login(input: LoginInput): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      '/api/auth/login',
      {
        email: input.email,
        password: input.password,
        organization_name: input.organization_name,
      },
      { timeout: TIMEOUT_DEFAULT },
    );
    return response.data;
  },

  /** Refresh an existing token. */
  async refresh(token: string): Promise<{ token: string }> {
    const response = await apiClient.post<{ token: string }>(
      '/api/auth/refresh',
      { token },
      { timeout: TIMEOUT_DEFAULT },
    );
    return response.data;
  },

  /** Log out — invalidates the token on the backend. */
  async logout(token: string): Promise<void> {
    await apiClient.post(
      '/api/auth/logout',
      { token },
      { timeout: TIMEOUT_DEFAULT },
    );
  },

  /** List organizations (public endpoint, used for login form). */
  async listOrganizations(search?: string): Promise<Organization[]> {
    const params = search ? { search } : undefined;
    const response = await apiClient.get<{ organizations: Organization[] }>(
      '/api/auth/organizations',
      { params, timeout: TIMEOUT_DEFAULT },
    );
    return response.data.organizations;
  },
};

// ---------------------------------------------------------------------------
// Portal API
// ---------------------------------------------------------------------------

export const portalApi = {
  /** Get the parent's children with today's presence status. */
  async getChildren(): Promise<PersonWithStatus[]> {
    const response = await apiClient.get<{ persons: PersonWithStatus[] }>(
      '/api/portal/persons',
      { timeout: TIMEOUT_PRESENCE },
    );
    return response.data.persons;
  },

  /** Get attendance history for a specific child within a date range. */
  async getAttendance(
    personId: string,
    range: DateRange,
  ): Promise<AttendanceRecord[]> {
    const response = await apiClient.get<{ attendance: AttendanceRecord[] }>(
      `/api/portal/persons/${personId}/attendance`,
      {
        params: {
          start_date: range.start_date,
          end_date: range.end_date,
        },
        timeout: TIMEOUT_MEDIUM,
      },
    );
    return response.data.attendance;
  },

  /** Get paginated notifications. */
  async getNotifications(page: number, limit = 20): Promise<Paginated<Notification>> {
    const response = await apiClient.get<Paginated<Notification>>(
      '/api/portal/notifications',
      {
        params: { page, limit },
        timeout: TIMEOUT_MEDIUM,
      },
    );
    return response.data;
  },

  /** Get all announcements for the parent's children. */
  async getAnnouncements(): Promise<Announcement[]> {
    const response = await apiClient.get<{ announcements: Announcement[] }>(
      '/api/portal/announcements',
      { timeout: TIMEOUT_MEDIUM },
    );
    return response.data.announcements;
  },
};

// ---------------------------------------------------------------------------
// Leave API
// ---------------------------------------------------------------------------

export const leaveApi = {
  /** List the parent's leave requests with pagination. */
  async list(page: number, limit = 20): Promise<Paginated<LeaveRequest>> {
    const response = await apiClient.get<Paginated<LeaveRequest>>(
      '/api/leave-requests',
      {
        params: { page, limit },
        timeout: TIMEOUT_DEFAULT,
      },
    );
    return response.data;
  },

  /** Submit a new leave request. */
  async submit(input: LeaveSubmitInput): Promise<LeaveRequest> {
    const response = await apiClient.post<{ leave_request: LeaveRequest }>(
      '/api/leave-requests',
      input,
      { timeout: TIMEOUT_DEFAULT },
    );
    return response.data.leave_request;
  },
};
