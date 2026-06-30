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

import type { AppRole } from '@/types/auth';

/** The top-level tab navigators, keyed by their RootStack route name. */
export type RoleNavigator = 'ParentTabs' | 'AdminTabs' | 'SuperAdminTabs';

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
  'SuperAdminProfile',
] as const;

export type ParentTabName = (typeof PARENT_TABS)[number];
export type AdminTabName = (typeof ADMIN_TABS)[number];
export type SuperAdminTabName = (typeof SUPER_ADMIN_TABS)[number];
export type AnyTabName = ParentTabName | AdminTabName | SuperAdminTabName;

/**
 * The "home" / dashboard tab for each role — the redirect target when a user
 * lands somewhere outside their permitted surface (Requirement 2.5).
 */
const DASHBOARD_TAB: Record<RoleNavigator, AnyTabName> = {
  ParentTabs: 'Home',
  AdminTabs: 'AdminDashboard',
  SuperAdminTabs: 'Platform',
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
