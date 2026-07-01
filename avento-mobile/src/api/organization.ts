/**
 * Organization API endpoint wrappers.
 *
 * Typed functions over the shared {@link apiClient} for organization-related
 * endpoints, such as fetching the authenticated user's organization name.
 *
 * Validates: Requirements 6.5
 */
import { apiClient } from './client';

// ─── Response shapes ─────────────────────────────────────────────────────────

/** Successful response from GET /api/organization/name. */
export interface OrganizationNameResponse {
  organization_name: string;
}

// ─── Endpoint functions ──────────────────────────────────────────────────────

export const organizationApi = {
  /**
   * Fetch the authenticated user's organization name.
   * GET /api/organization/name
   *
   * Returns the organization_name string on success, or null if the request
   * fails (e.g. 404 not found, network error).
   */
  async getOrganizationName(): Promise<string | null> {
    try {
      const res = await apiClient.get<OrganizationNameResponse>('/api/organization/name');
      return res.data.organization_name ?? null;
    } catch {
      return null;
    }
  },
};

export default organizationApi;
