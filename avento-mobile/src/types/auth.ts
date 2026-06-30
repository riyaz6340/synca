/**
 * Authentication types for the Avento mobile app.
 * Validates: Requirements 2.1, 2.2, 2.3
 */

/** User roles supported by the platform */
export type AppRole = 'Admin' | 'SuperAdmin' | 'Stakeholder';

/** User object returned by the login endpoint */
export interface AppUser {
  id: string;
  email: string;
  role: AppRole;
  organization_id: string;
}

/** Zustand auth store state and actions */
export interface AuthState {
  token: string | null;
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;

  login: (email: string, password: string, orgName: string, orgId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => void;
  restoreSession: () => Promise<void>;
}
