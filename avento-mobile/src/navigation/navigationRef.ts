/**
 * Navigation ref + deep-link dispatch for push-notification taps.
 *
 * The push-notification service ({@link pushNotifications}) is intentionally
 * decoupled from the navigator: it resolves a tapped notification to a plain
 * `{ screen, params }` target and hands it to an injected handler. This module
 * provides that handler by owning a {@link NavigationContainerRef}, so taps can
 * drive navigation from outside the React tree (e.g. a cold-start tap) without
 * creating an import cycle through the navigator component.
 *
 * `navigateToTarget` translates the flat target screen names emitted by
 * {@link resolveNavigationTarget} ('AttendanceHistory', 'AnnouncementDetail')
 * into the nested route path they actually live at (tab → stack → screen),
 * falling back to a best-effort flat navigate for any screen we have not mapped.
 * All navigation is guarded by `navigationRef.isReady()` so a tap that arrives
 * before the container has mounted is a safe no-op rather than a crash.
 *
 * Validates: Requirements 22.3
 */

import { createNavigationContainerRef } from '@react-navigation/native';

import type { NavigationTarget } from '@/services/pushNotifications';
import { useAuthStore } from '@/stores/auth';
import type { AppRole } from '@/types/auth';
import type { RootStackParamList } from '@/types/navigation';

/**
 * The single navigation ref attached to the root `NavigationContainer`. Shared
 * so notification taps (handled outside React) can navigate imperatively.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Maps a flat push target screen name + user role to the nested route path it
 * lives under, expressed as the arguments to `navigationRef.navigate(...)`.
 *
 * React Navigation reaches a deeply-nested screen by navigating to the top-level
 * route and passing a nested `screen`/`params` descriptor. We encode that here
 * for the deep-link destinations the push service can emit:
 *
 *  - `AttendanceHistory`  → ParentTabs → Attendance stack → AttendanceHistory
 *  - `AnnouncementDetail` → ParentTabs → Announcements stack → AnnouncementDetail
 *  - `LeaveList`          → ParentTabs → Leave stack → LeaveList (any role)
 *  - `LeaveManagement`    → Role-dependent tab → Leave management screen
 *
 * Returns `null` for an unmapped screen so the caller can fall back to a flat
 * best-effort navigate.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */
export function nestedRouteFor(
  target: NavigationTarget,
  role: AppRole | null | undefined,
): { name: string; params: object } | null {
  switch (target.screen) {
    case 'AttendanceHistory':
      return {
        name: 'ParentTabs',
        params: {
          screen: 'Attendance',
          params: {
            screen: 'AttendanceHistory',
            params: target.params,
          },
        },
      };
    case 'AnnouncementDetail':
      return {
        name: 'ParentTabs',
        params: {
          screen: 'Announcements',
          params: {
            screen: 'AnnouncementDetail',
            params: target.params,
          },
        },
      };
    case 'LeaveList':
      // Stakeholder (Parent) is the only role that lands on LeaveList.
      // Null/undefined role defaults to ParentTabs (least-privileged).
      return {
        name: 'ParentTabs',
        params: {
          screen: 'Leave',
          params: {
            screen: 'LeaveList',
            params: target.params,
          },
        },
      };
    case 'LeaveManagement':
      switch (role) {
        case 'Admin':
          return {
            name: 'AdminTabs',
            params: {
              screen: 'Management',
              params: {
                screen: 'LeaveManagement',
                params: target.params,
              },
            },
          };
        case 'SuperAdmin':
          return {
            name: 'SuperAdminTabs',
            params: {
              screen: 'Organizations',
              params: {
                screen: 'OrgList',
                params: target.params,
              },
            },
          };
        case 'Teacher':
          return {
            name: 'TeacherTabs',
            params: {
              screen: 'TeacherLeave',
              params: {
                screen: 'LeaveManagement',
                params: target.params,
              },
            },
          };
        default:
          // Fallback: least-privileged (ParentTabs)
          return {
            name: 'ParentTabs',
            params: {
              screen: 'Leave',
              params: {
                screen: 'LeaveList',
                params: target.params,
              },
            },
          };
      }
    default:
      return null;
  }
}

/**
 * Navigate to a resolved push-notification {@link NavigationTarget}.
 *
 * No-ops when the navigation container is not yet ready (e.g. a cold-start tap
 * that fires before mount), so the caller never has to guard readiness itself.
 * Known screens are routed through their nested path; anything else falls back
 * to a flat navigate (deep nested routing for new screens can be refined by
 * extending {@link nestedRouteFor}).
 */
export function navigateToTarget(target: NavigationTarget): void {
  if (!navigationRef.isReady()) {
    return;
  }

  // React Navigation's `navigate` is heavily overloaded; widen it to a plain
  // (name, params) signature so we can dispatch dynamic route names without
  // fighting the generic overload resolution.
  const navigate = navigationRef.navigate as unknown as (
    name: string,
    params?: object,
  ) => void;

  const role = useAuthStore.getState().user?.role ?? null;

  const nested = nestedRouteFor(target, role);
  if (nested) {
    navigate(nested.name, nested.params);
    return;
  }

  // Best-effort flat navigation for screens we have not explicitly mapped.
  // Deep nested routing for new screens can be refined via `nestedRouteFor`.
  navigate(target.screen, target.params);
}
