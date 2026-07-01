/**
 * SuperAdmin API endpoint wrappers.
 *
 * Typed functions over the shared {@link apiClient} covering platform-wide
 * statistics and organization management.
 *
 * Validates: Requirements 18.1, 19.1, 19.3, 19.5
 */
import { apiClient } from './client';
import type { Organization, OrganizationDetail } from '@/types/models';
import type { Paginated, PaginationParams } from './portal';

// ─── Response shapes ─────────────────────────────────────────────────────────

/** A `{ status, count }` bucket used in dashboard breakdowns. */
export interface PlatformAttendanceBucket {
  presence_status: string;
  count: number;
}

/** Platform-wide statistics returned by the SuperAdmin dashboard. */
export interface PlatformDashboardResponse {
  overview: {
    total_organizations: number;
    total_persons: number;
    total_users: number;
    total_attendance_records: number;
    monthly_revenue: number;
  };
  plan_breakdown: Array<{ plan: string; count: number }>;
  industry_breakdown: Array<{ industry_module: string; count: number }>;
  billing_breakdown: Array<{ billing_status: string; count: number }>;
  today_attendance: PlatformAttendanceBucket[];
  recent_organizations: Array<Record<string, unknown>>;
  organizations_by_size: Array<Record<string, unknown>>;
}

/** A row in the SuperAdmin organization list. */
export interface OrganizationSummary {
  id: string;
  name: string;
  industry_module: string;
  plan: string;
  monthly_amount: number;
  billing_status: string;
  person_count: number;
  created_at: string;
}

/** Filters for the organization list. */
export interface OrganizationListParams extends PaginationParams {
  plan?: string;
  billing_status?: string;
  search?: string;
}

/** Payload for onboarding a new organization (with its first admin user). */
export interface CreateOrganizationInput {
  name: string;
  industry_module?: string;
  plan?: string;
  admin_email: string;
  admin_password: string;
}

/** Result of creating an organization. */
export interface CreateOrganizationResult {
  organization: Organization & Record<string, unknown>;
  admin_user: { id: string; email: string; role: string; organization_id: string };
}

/** Payload for updating an organization's plan/billing details (plan route). */
export interface UpdateOrganizationPlanInput {
  plan?: string;
  monthly_amount?: number;
  billing_status?: string;
}

/**
 * Payload for the full organization update (Requirement 19.5).
 * Partial — only the provided fields are updated.
 */
export interface UpdateOrganizationInput {
  name?: string;
  industry_module?: string;
  plan?: string;
  monthly_amount?: number;
  billing_status?: string;
}

// ─── Endpoint functions ──────────────────────────────────────────────────────

export const superAdminApi = {
  /**
   * Fetch platform-wide statistics for the SuperAdmin dashboard.
   * GET /api/super-admin/dashboard
   */
  async getPlatformDashboard(): Promise<PlatformDashboardResponse> {
    const res = await apiClient.get<PlatformDashboardResponse>(
      '/api/super-admin/dashboard',
    );
    return res.data;
  },

  /**
   * List all organizations (paginated, with optional plan/status/search).
   * GET /api/super-admin/organizations
   */
  async getOrganizations(
    params: OrganizationListParams = {},
  ): Promise<Paginated<OrganizationSummary>> {
    const { page = 1, limit = 20, plan, billing_status, search } = params;
    const res = await apiClient.get<Paginated<OrganizationSummary>>(
      '/api/super-admin/organizations',
      { params: { page, limit, plan, billing_status, search } },
    );
    return res.data;
  },

  /**
   * Onboard a new organization together with its first admin user.
   * POST /api/super-admin/organizations
   */
  async createOrganization(
    input: CreateOrganizationInput,
  ): Promise<CreateOrganizationResult> {
    const res = await apiClient.post<CreateOrganizationResult>(
      '/api/super-admin/organizations',
      input,
    );
    return res.data;
  },

  /**
   * Update an organization's general details (name, industry module) along with
   * plan/billing fields. Partial update. (Requirement 19.5)
   * PUT /api/super-admin/organizations/:id  → `{ organization }`
   */
  async updateOrganization(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationSummary> {
    const res = await apiClient.put<{ organization: OrganizationSummary }>(
      `/api/super-admin/organizations/${id}`,
      input,
    );
    return res.data.organization;
  },

  /**
   * Update only an organization's plan/billing details.
   * PUT /api/super-admin/organizations/:id/plan  → `{ organization }`
   */
  async updateOrganizationPlan(
    id: string,
    input: UpdateOrganizationPlanInput,
  ): Promise<OrganizationSummary> {
    const res = await apiClient.put<{ organization: OrganizationSummary }>(
      `/api/super-admin/organizations/${id}/plan`,
      input,
    );
    return res.data.organization;
  },

  /**
   * Get detailed info for a single organization, normalized to the
   * {@link OrganizationDetail} domain model (org fields + computed counts).
   * GET /api/super-admin/organizations/:id  → `{ organization, stats }`
   */
  async getOrganizationDetail(id: string): Promise<OrganizationDetail> {
    const res = await apiClient.get<{
      organization: {
        id: string;
        name: string;
        plan: string;
        created_at: string;
      };
      stats: { persons: number; users: number; groups: number; attendance_records: number };
    }>(`/api/super-admin/organizations/${id}`);

    const { organization, stats } = res.data;
    return {
      id: organization.id,
      name: organization.name,
      plan_type: organization.plan,
      user_count: stats.users,
      person_count: stats.persons,
      created_at: organization.created_at,
    };
  },
};

// ─── Analytics types ─────────────────────────────────────────────────────────

/** Response from GET /api/super-admin/analytics. */
export interface AnalyticsMetricsResponse {
  dau: number;
  wau: number;
  mau: number;
  yau: number;
}

export const superAdminAnalyticsApi = {
  /**
   * Fetch DAU/WAU/MAU/YAU metrics for the current period.
   * GET /api/super-admin/analytics
   */
  async getAnalyticsMetrics(): Promise<AnalyticsMetricsResponse> {
    const res = await apiClient.get<AnalyticsMetricsResponse>(
      '/api/super-admin/analytics',
    );
    return res.data;
  },
};

export default superAdminApi;
