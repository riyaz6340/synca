/**
 * Unit tests for the API endpoint modules (auth, portal, admin, superadmin).
 *
 * These verify that each wrapper constructs the correct HTTP request — path,
 * method, query params, and request body — and normalizes the response into
 * the expected domain shape. Requests are intercepted with MSW so no real
 * network calls are made.
 */
import { http, HttpResponse } from 'msw';

import { server } from '@/__tests__/mocks/server';
import { ENV } from '@/config/env';
import { authApi } from './auth';
import { portalApi } from './portal';
import { adminApi } from './admin';
import { superAdminApi } from './superadmin';

const API = ENV.API_URL;

/** Captured details of the most recent intercepted request. */
interface CapturedRequest {
  method: string;
  pathname: string;
  search: URLSearchParams;
  body: unknown;
}

let captured: CapturedRequest | undefined;

/**
 * Register a one-off handler that records the incoming request and returns the
 * provided JSON payload. Returns nothing — assertions read `captured`.
 */
function intercept(
  method: 'get' | 'post' | 'put' | 'patch',
  path: string,
  response: unknown,
): void {
  server.use(
    http[method](`${API}${path}`, async ({ request }) => {
      const url = new URL(request.url);
      let body: unknown;
      // Only POST/PUT/PATCH carry a JSON body.
      if (method !== 'get') {
        const text = await request.text();
        body = text ? JSON.parse(text) : undefined;
      }
      captured = {
        method: request.method,
        pathname: url.pathname,
        search: url.searchParams,
        body,
      };
      return HttpResponse.json(response as Record<string, unknown>);
    }),
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  captured = undefined;
});
afterAll(() => server.close());

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('authApi', () => {
  it('login posts credentials and returns token + user', async () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'Admin', organization_id: 'org-1' };
    intercept('post', '/api/auth/login', { token: 'jwt-123', user });

    const result = await authApi.login({
      email: 'a@b.com',
      password: 'secret',
      organization_name: 'Demo',
      organization_id: 'org-1',
    });

    expect(captured?.method).toBe('POST');
    expect(captured?.pathname).toBe('/api/auth/login');
    expect(captured?.body).toEqual({
      email: 'a@b.com',
      password: 'secret',
      organization_name: 'Demo',
      organization_id: 'org-1',
    });
    expect(result).toEqual({ token: 'jwt-123', user });
  });

  it('login omits organization_id when not provided', async () => {
    intercept('post', '/api/auth/login', { token: 't', user: {} });

    await authApi.login({ email: 'a@b.com', password: 'p', organization_name: 'Demo' });

    expect(captured?.body).toEqual({
      email: 'a@b.com',
      password: 'p',
      organization_name: 'Demo',
    });
  });

  it('refreshToken posts the existing token and returns a new one', async () => {
    intercept('post', '/api/auth/refresh', { token: 'fresh' });

    const result = await authApi.refreshToken('old-token');

    expect(captured?.pathname).toBe('/api/auth/refresh');
    expect(captured?.body).toEqual({ token: 'old-token' });
    expect(result).toEqual({ token: 'fresh' });
  });

  it('changePassword posts current + new password', async () => {
    intercept('post', '/api/auth/change-password', { message: 'ok' });

    await authApi.changePassword({ current_password: 'old', new_password: 'newpass' });

    expect(captured?.pathname).toBe('/api/auth/change-password');
    expect(captured?.body).toEqual({ current_password: 'old', new_password: 'newpass' });
  });

  it('fetchOrganizations unwraps the organizations array and forwards search', async () => {
    intercept('get', '/api/auth/organizations', {
      organizations: [{ id: 'org-1', name: 'Demo Organization' }],
    });

    const orgs = await authApi.fetchOrganizations('dem');

    expect(captured?.pathname).toBe('/api/auth/organizations');
    expect(captured?.search.get('search')).toBe('dem');
    expect(orgs).toEqual([{ id: 'org-1', name: 'Demo Organization' }]);
  });
});

// ─── Portal ───────────────────────────────────────────────────────────────────

describe('portalApi', () => {
  it('getPersons unwraps the persons array', async () => {
    const persons = [{ id: 'p1', name: 'Kid', current_status: null }];
    intercept('get', '/api/portal/persons', { persons });

    const result = await portalApi.getPersons();

    expect(captured?.method).toBe('GET');
    expect(captured?.pathname).toBe('/api/portal/persons');
    expect(result).toEqual(persons);
  });

  it('getAttendanceHistory sends date range params and unwraps attendance', async () => {
    const attendance = [{ id: 'a1', date: '2024-01-10', time: null, presence_status: 'Present' }];
    intercept('get', '/api/portal/persons/p1/attendance', { attendance });

    const result = await portalApi.getAttendanceHistory('p1', {
      start_date: '2024-01-01',
      end_date: '2024-01-31',
    });

    expect(captured?.pathname).toBe('/api/portal/persons/p1/attendance');
    expect(captured?.search.get('start_date')).toBe('2024-01-01');
    expect(captured?.search.get('end_date')).toBe('2024-01-31');
    expect(result).toEqual(attendance);
  });

  it('getNotifications forwards pagination params and returns the envelope', async () => {
    const payload = {
      data: [{ id: 'n1', title: 'Hi', body: 'B', sent_at: null, created_at: '2024-01-01' }],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    };
    intercept('get', '/api/portal/notifications', payload);

    const result = await portalApi.getNotifications({ page: 2, limit: 10 });

    expect(captured?.search.get('page')).toBe('2');
    expect(captured?.search.get('limit')).toBe('10');
    expect(result).toEqual(payload);
  });

  it('submitLeaveRequest posts the form and unwraps leave_request', async () => {
    const leave = {
      id: 'l1',
      person_id: 'p1',
      start_date: '2024-02-01',
      end_date: '2024-02-02',
      reason: 'sick',
      status: 'Pending',
    };
    intercept('post', '/api/leave-requests', { leave_request: leave });

    const result = await portalApi.submitLeaveRequest({
      person_id: 'p1',
      start_date: '2024-02-01',
      end_date: '2024-02-02',
      reason: 'sick',
    });

    expect(captured?.method).toBe('POST');
    expect(captured?.pathname).toBe('/api/leave-requests');
    expect(captured?.body).toEqual({
      person_id: 'p1',
      start_date: '2024-02-01',
      end_date: '2024-02-02',
      reason: 'sick',
    });
    expect(result).toEqual(leave);
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

describe('adminApi', () => {
  it('getDashboard fetches the summary from /api/attendance/dashboard with the date param', async () => {
    const summary = {
      date: '2024-03-01',
      total_students: 50,
      present: 40,
      absent: 5,
      late: 3,
      on_leave: 2,
      present_percentage: 80,
      absent_percentage: 10,
      late_percentage: 6,
      on_leave_percentage: 4,
      pending_leave_requests: 7,
      groups_not_marked: 2,
    };
    intercept('get', '/api/attendance/dashboard', summary);

    const result = await adminApi.getDashboard('2024-03-01');

    expect(captured?.method).toBe('GET');
    expect(captured?.pathname).toBe('/api/attendance/dashboard');
    expect(captured?.search.get('date')).toBe('2024-03-01');
    expect(result).toEqual(summary);
  });

  it('submitBulkAttendance posts the payload to /api/attendance/bulk', async () => {
    const payload = {
      group_id: 'g1',
      date: '2024-03-01',
      records: [
        { person_id: 'p1', presence_status: 'Present' as const },
        { person_id: 'p2', presence_status: 'Absent' as const },
      ],
    };
    intercept('post', '/api/attendance/bulk', { message: 'ok', count: 2, records: [] });

    const result = await adminApi.submitBulkAttendance(payload);

    expect(captured?.method).toBe('POST');
    expect(captured?.pathname).toBe('/api/attendance/bulk');
    expect(captured?.body).toEqual(payload);
    expect(result).toEqual({ message: 'ok', count: 2, records: [] });
  });

  it('getPersons returns the paginated envelope with default params', async () => {
    const payload = {
      data: [{ id: 'p1', name: 'Kid', is_active: true }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    intercept('get', '/api/persons', payload);

    const result = await adminApi.getPersons();

    expect(captured?.search.get('page')).toBe('1');
    expect(captured?.search.get('limit')).toBe('20');
    expect(result).toEqual(payload);
  });

  it('createPerson posts to /api/persons and unwraps person', async () => {
    const person = { id: 'p9', name: 'New Kid', is_active: true };
    intercept('post', '/api/persons', { person });

    const result = await adminApi.createPerson({ name: 'New Kid' });

    expect(captured?.method).toBe('POST');
    expect(captured?.pathname).toBe('/api/persons');
    expect(captured?.body).toEqual({ name: 'New Kid' });
    expect(result).toEqual(person);
  });

  it('deactivatePerson PATCHes the deactivate sub-resource', async () => {
    const person = { id: 'p1', name: 'Kid', is_active: false };
    intercept('patch', '/api/persons/p1/deactivate', { message: 'done', person });

    const result = await adminApi.deactivatePerson('p1');

    expect(captured?.method).toBe('PATCH');
    expect(captured?.pathname).toBe('/api/persons/p1/deactivate');
    expect(result).toEqual(person);
  });

  it('rejectLeave PUTs review_comment to the reject sub-resource', async () => {
    const leave = { id: 'l1', person_id: 'p1', start_date: 'x', end_date: 'y', reason: 'r', status: 'Rejected' };
    intercept('put', '/api/leave-requests/l1/reject', { leave_request: leave });

    const result = await adminApi.rejectLeave('l1', 'not allowed');

    expect(captured?.method).toBe('PUT');
    expect(captured?.pathname).toBe('/api/leave-requests/l1/reject');
    expect(captured?.body).toEqual({ review_comment: 'not allowed' });
    expect(result).toEqual(leave);
  });

  it('getAnnouncements unwraps the data array', async () => {
    const data = [{ id: 'an1', title: 'T', body: 'B', published_at: '2024-01-01' }];
    intercept('get', '/api/announcements', { data });

    const result = await adminApi.getAnnouncements();

    expect(captured?.pathname).toBe('/api/announcements');
    expect(result).toEqual(data);
  });

  it('getReports forwards filters and unwraps the report', async () => {
    const report = { persons: [], total_days: 0 };
    intercept('get', '/api/reports/attendance', { report });

    const result = await adminApi.getReports({
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      group_id: 'g1',
    });

    expect(captured?.pathname).toBe('/api/reports/attendance');
    expect(captured?.search.get('start_date')).toBe('2024-01-01');
    expect(captured?.search.get('end_date')).toBe('2024-01-31');
    expect(captured?.search.get('group_id')).toBe('g1');
    expect(result).toEqual(report);
  });

  it('getAuditLogs sends limit and unwraps data', async () => {
    const data = [
      {
        id: 'al1',
        action: 'CREATE',
        entity_type: 'person',
        entity_id: 'p1',
        user_id: 'u1',
        user_email: 'a@b.com',
        timestamp: '2024-01-01',
      },
    ];
    intercept('get', '/api/audit-logs', { data });

    const result = await adminApi.getAuditLogs({ limit: 25 });

    expect(captured?.pathname).toBe('/api/audit-logs');
    expect(captured?.search.get('limit')).toBe('25');
    expect(result).toEqual(data);
  });
});

// ─── SuperAdmin ────────────────────────────────────────────────────────────────

describe('superAdminApi', () => {
  it('getOrganizations forwards search/plan filters and returns the envelope', async () => {
    const payload = {
      data: [
        {
          id: 'org-1',
          name: 'Demo',
          industry_module: 'school',
          plan: 'free',
          monthly_amount: 0,
          billing_status: 'trial',
          person_count: 3,
          created_at: '2024-01-01',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    intercept('get', '/api/super-admin/organizations', payload);

    const result = await superAdminApi.getOrganizations({ search: 'dem', plan: 'free' });

    expect(captured?.pathname).toBe('/api/super-admin/organizations');
    expect(captured?.search.get('search')).toBe('dem');
    expect(captured?.search.get('plan')).toBe('free');
    expect(result).toEqual(payload);
  });

  it('getOrganizationDetail maps organization + stats to OrganizationDetail', async () => {
    intercept('get', '/api/super-admin/organizations/org-1', {
      organization: { id: 'org-1', name: 'Demo', plan: 'pro', created_at: '2024-01-01' },
      stats: { persons: 42, users: 5, groups: 3, attendance_records: 100 },
    });

    const result = await superAdminApi.getOrganizationDetail('org-1');

    expect(captured?.pathname).toBe('/api/super-admin/organizations/org-1');
    expect(result).toEqual({
      id: 'org-1',
      name: 'Demo',
      plan_type: 'pro',
      user_count: 5,
      person_count: 42,
      created_at: '2024-01-01',
    });
  });

  it('updateOrganization PUTs a partial update to the full-update endpoint', async () => {
    const organization = {
      id: 'org-1',
      name: 'Renamed Org',
      industry_module: 'gym',
      plan: 'pro',
      monthly_amount: 49,
      billing_status: 'active',
      person_count: 3,
      created_at: '2024-01-01',
    };
    intercept('put', '/api/super-admin/organizations/org-1', { organization });

    const result = await superAdminApi.updateOrganization('org-1', {
      name: 'Renamed Org',
      industry_module: 'gym',
      plan: 'pro',
    });

    expect(captured?.method).toBe('PUT');
    expect(captured?.pathname).toBe('/api/super-admin/organizations/org-1');
    expect(captured?.body).toEqual({ name: 'Renamed Org', industry_module: 'gym', plan: 'pro' });
    expect(result).toEqual(organization);
  });

  it('updateOrganizationPlan PUTs to the plan sub-resource', async () => {
    const organization = {
      id: 'org-1',
      name: 'Demo',
      industry_module: 'school',
      plan: 'pro',
      monthly_amount: 49,
      billing_status: 'active',
      person_count: 3,
      created_at: '2024-01-01',
    };
    intercept('put', '/api/super-admin/organizations/org-1/plan', { organization });

    const result = await superAdminApi.updateOrganizationPlan('org-1', {
      plan: 'pro',
      monthly_amount: 49,
      billing_status: 'active',
    });

    expect(captured?.method).toBe('PUT');
    expect(captured?.pathname).toBe('/api/super-admin/organizations/org-1/plan');
    expect(captured?.body).toEqual({ plan: 'pro', monthly_amount: 49, billing_status: 'active' });
    expect(result).toEqual(organization);
  });

  it('createOrganization posts the onboarding payload', async () => {
    const response = {
      organization: { id: 'org-9', name: 'New Org' },
      admin_user: { id: 'u9', email: 'admin@new.com', role: 'Admin', organization_id: 'org-9' },
    };
    intercept('post', '/api/super-admin/organizations', response);

    const result = await superAdminApi.createOrganization({
      name: 'New Org',
      admin_email: 'admin@new.com',
      admin_password: 'secret',
    });

    expect(captured?.method).toBe('POST');
    expect(captured?.pathname).toBe('/api/super-admin/organizations');
    expect(captured?.body).toEqual({
      name: 'New Org',
      admin_email: 'admin@new.com',
      admin_password: 'secret',
    });
    expect(result).toEqual(response);
  });
});
