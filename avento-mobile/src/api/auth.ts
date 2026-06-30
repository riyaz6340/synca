/**
 * Authentication API endpoint wrappers.
 *
 * Typed functions over the shared {@link apiClient} covering login, token
 * refresh, logout, password change, and the public organization list used by
 * the login screen's searchable dropdown.
 *
 * Validates: Requirements 8.2, 24.1
 */
import { apiClient } from './client';
import type { AppUser } from '@/types/auth';
import type { Organization } from '@/types/models';

// ─── Request / response shapes ───────────────────────────────────────────────

/** Credentials submitted to the login endpoint. */
export interface LoginInput {
  email: string;
  password: string;
  organization_name: string;
  /** Optional explicit org id (skips name → id resolution on the backend). */
  organization_id?: string;
}

/** Successful login response: a JWT plus the authenticated user. */
export interface LoginResponse {
  token: string;
  user: AppUser;
}

/** Response from the token refresh endpoint. */
export interface RefreshResponse {
  token: string;
}

/** Payload for changing the authenticated user's password. */
export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
}

// ─── Endpoint functions ──────────────────────────────────────────────────────

export const authApi = {
  /**
   * Authenticate with email, password, and organization.
   * POST /api/auth/login
   */
  async login(input: LoginInput): Promise<LoginResponse> {
    const body: Record<string, string> = {
      email: input.email,
      password: input.password,
      organization_name: input.organization_name,
    };
    if (input.organization_id) {
      body.organization_id = input.organization_id;
    }
    const res = await apiClient.post<LoginResponse>('/api/auth/login', body);
    return res.data;
  },

  /**
   * Invalidate the current token on the backend.
   * POST /api/auth/logout
   */
  async logout(token: string): Promise<void> {
    await apiClient.post('/api/auth/logout', { token });
  },

  /**
   * Exchange an existing (near-expiry) token for a fresh one.
   * POST /api/auth/refresh
   */
  async refreshToken(token: string): Promise<RefreshResponse> {
    const res = await apiClient.post<RefreshResponse>('/api/auth/refresh', { token });
    return res.data;
  },

  /**
   * Change the authenticated user's password.
   * POST /api/auth/change-password
   */
  async changePassword(input: ChangePasswordInput): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>(
      '/api/auth/change-password',
      input,
    );
    return res.data;
  },

  /**
   * Fetch the public organization list for the login dropdown, optionally
   * filtered server-side by a search string.
   * GET /api/auth/organizations?search
   */
  async fetchOrganizations(search?: string): Promise<Organization[]> {
    const res = await apiClient.get<{ organizations: Organization[] }>(
      '/api/auth/organizations',
      { params: search ? { search } : undefined },
    );
    return res.data.organizations;
  },
};

export default authApi;
