/**
 * Authentication types for the Avento mobile app.
 * Validates: Requirements 2.1, 2.2, 2.3
 */

/** User roles supported by the platform */
export type AppRole = 'Admin' | 'SuperAdmin' | 'Stakeholder' | 'Teacher';

/** Granular permissions that can be granted to a Teacher user */
export type TeacherPermission =
  | 'mark_attendance'
  | 'view_attendance_reports'
  | 'create_announcements'
  | 'publish_announcements'
  | 'manage_holidays'
  | 'approve_leave_requests'
  | 'view_leave_requests'
  | 'manage_students'
  | 'manage_groups';

/** User object returned by the login endpoint */
export interface AppUser {
  id: string;
  email: string;
  role: AppRole;
  organization_id: string;
  /** Granted permissions — present only for Teacher users */
  permissions?: TeacherPermission[];
  /** Organization name — included in login response (Requirement 7.1) */
  organization_name?: string;
  /** Organization logo URL — included in login response (Requirement 7.1) */
  logo_url?: string | null;
  /** Organization primary color — included in login response (Requirement 7.1) */
  primary_color?: string | null;
}

/** Zustand auth store state and actions */
export interface AuthState {
  token: string | null;
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  /** Cached organization name for branding (Requirement 6.1, 6.2) */
  organizationName: string | null;
  /** Cached organization logo URL for branding (Requirement 7.1, 7.5) */
  logoUrl: string | null;
  /** Cached organization primary color for branding (Requirement 7.1, 7.5) */
  primaryColor: string | null;

  login: (email: string, password: string, orgName: string, orgId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => void;
  restoreSession: () => Promise<void>;
}
