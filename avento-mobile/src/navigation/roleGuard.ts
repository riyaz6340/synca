/**
 * roleGuard — pure role → navigation mapping helpers.
 *
 * This module is the single source of truth for "what may each role see?". It
 * is intentionally free of React and React Navigation so it can be unit- and
 * property-tested in isolation (Property 4, task 6.3).
 *
 * The platform 'Stakeholder' role is the Parent experience. Unknown / missing
 * roles fall back to the Parent surface (the least-privileged one) rather than
 * throwing, mirroring {@link tabsRouteForRole} in RootNavigator.
 *
 * Coordinates with RootNavigator's `tabsRouteForRole`: {@link navigatorForRole}
 * returns the same RootStack route names so the two never disagree.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import type { AppRole, TeacherPermission } from '@/types/auth';

/** The top-level tab navigators, keyed by their RootStack route name. */
export type RoleNavigator = 'ParentTabs' | 'AdminTabs' | 'SuperAdminTabs' | 'TeacherTabs';

/**
 * The ordered tab-route names for each role's bottom-tab navigator. These match
 * the keys of the corresponding `*TabsParamList` in `src/types/navigation.ts`.
 */
export const PARENT_TABS = [
  'Home',
  'Attendance',
  'Announcements',
  'Leave',
  'ParentProfile',
] as const;

export const ADMIN_TABS = [
  'AdminDashboard',
  'AdminAttendance',
  'Management',
  'AdminProfile',
] as const;

export const SUPER_ADMIN_TABS = [
  'Platform',
  'Organizations',
  'SuperAdminAnalytics',
  'SuperAdminProfile',
] as const;

export const TEACHER_TABS = [
  'TeacherAttendance',
  'TeacherAnnouncements',
  'TeacherLeave',
  'TeacherStudents',
  'TeacherProfile',
] as const;

export type ParentTabName = (typeof PARENT_TABS)[number];
export type AdminTabName = (typeof ADMIN_TABS)[number];
export type SuperAdminTabName = (typeof SUPER_ADMIN_TABS)[number];
export type TeacherTabName = (typeof TEACHER_TABS)[number];
export type AnyTabName = ParentTabName | AdminTabName | SuperAdminTabName | TeacherTabName;

/**
 * The "home" / dashboard tab for each role — the redirect target when a user
 * lands somewhere outside their permitted surface (Requirement 2.5).
 */
const DASHBOARD_TAB: Record<RoleNavigator, AnyTabName> = {
  ParentTabs: 'Home',
  AdminTabs: 'AdminDashboard',
  SuperAdminTabs: 'Platform',
  TeacherTabs: 'TeacherAttendance',
};

/**
 * Map a user role to its tab navigator's RootStack route name. Mirrors
 * RootNavigator's `tabsRouteForRole` so navigation never disagrees about where
 * a role belongs.
 */
export function navigatorForRole(role: AppRole | null | undefined): RoleNavigator {
  switch (role) {
    case 'Admin':
      return 'AdminTabs';
    case 'SuperAdmin':
      return 'SuperAdminTabs';
    case 'Teacher':
      return 'TeacherTabs';
    case 'Stakeholder':
      return 'ParentTabs';
    default:
      return 'ParentTabs';
  }
}

/**
 * The exact, ordered set of tab-route names accessible to the given role.
 * Returned as a fresh array so callers cannot mutate the canonical constants.
 */
export function tabSetForRole(
  role: AppRole | null | undefined,
): readonly AnyTabName[] {
  switch (navigatorForRole(role)) {
    case 'AdminTabs':
      return [...ADMIN_TABS];
    case 'SuperAdminTabs':
      return [...SUPER_ADMIN_TABS];
    case 'TeacherTabs':
      return [...TEACHER_TABS];
    case 'ParentTabs':
    default:
      return [...PARENT_TABS];
  }
}

/**
 * The dashboard (home) tab-route name for a role — the redirect destination for
 * unauthorized navigation attempts (Requirement 2.5).
 */
export function dashboardTabForRole(
  role: AppRole | null | undefined,
): AnyTabName {
  return DASHBOARD_TAB[navigatorForRole(role)];
}

/**
 * Whether the given navigator is the one the role is permitted to use. Used by
 * each tab navigator's render-time guard to detect wrong-role mounts.
 */
export function isNavigatorAllowedForRole(
  navigator: RoleNavigator,
  role: AppRole | null | undefined,
): boolean {
  return navigatorForRole(role) === navigator;
}

/**
 * Whether a given tab-route name is accessible to the role. A tab outside the
 * role's set is "unauthorized" and should redirect to the role's dashboard.
 */
export function isTabAllowedForRole(
  tab: string,
  role: AppRole | null | undefined,
): boolean {
  return (tabSetForRole(role) as readonly string[]).includes(tab);
}

// ---------------------------------------------------------------------------
// Teacher permission → tab mapping (Requirement 1.6, 11.7)
// ---------------------------------------------------------------------------

/**
 * Mapping from each Teacher tab to the permissions that grant access to it. A
 * tab is visible if the Teacher holds at least one of its listed permissions.
 */
export const TEACHER_TAB_PERMISSIONS: Record<TeacherTabName, TeacherPermission[]> = {
  TeacherAttendance: ['mark_attendance', 'view_attendance_reports'],
  TeacherAnnouncements: ['create_announcements', 'publish_announcements'],
  TeacherLeave: ['approve_leave_requests', 'view_leave_requests'],
  TeacherStudents: ['manage_students'],
  TeacherProfile: [], // always visible
};

/**
 * Filter Teacher tabs to only those the user has permission for. The Profile
 * tab is always included. Returns the filtered tab names in their canonical
 * order.
 */
export function visibleTeacherTabs(
  permissions: TeacherPermission[],
): TeacherTabName[] {
  return TEACHER_TABS.filter((tab) => {
    const required = TEACHER_TAB_PERMISSIONS[tab];
    // Empty means always visible (Profile tab)
    if (required.length === 0) return true;
    return required.some((perm) => permissions.includes(perm));
  }) as TeacherTabName[];
}
