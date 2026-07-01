/**
 * Tests for the pure role -> navigation mapping helpers.
 *
 * These exhaustively pin down each role's accessible tab set, redirect
 * destination, and navigator ownership -- the deterministic core behind
 * Property 4 (role-based navigation isolation) and Requirement 2.5's
 * unauthorized-redirect rule. Kept free of rendering so they stay fast and
 * focused on the contract the tab navigators rely on.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.5, 11.7
 */

import type { AppRole } from '@/types/auth';

import {
  ADMIN_TABS,
  PARENT_TABS,
  SUPER_ADMIN_TABS,
  TEACHER_TABS,
  dashboardTabForRole,
  isNavigatorAllowedForRole,
  isTabAllowedForRole,
  navigatorForRole,
  tabSetForRole,
  visibleTeacherTabs,
} from './roleGuard';

describe('navigatorForRole', () => {
  it('maps each role to its own tab navigator', () => {
    expect(navigatorForRole('Admin')).toBe('AdminTabs');
    expect(navigatorForRole('SuperAdmin')).toBe('SuperAdminTabs');
    expect(navigatorForRole('Stakeholder')).toBe('ParentTabs');
    expect(navigatorForRole('Teacher')).toBe('TeacherTabs');
  });

  it('falls back to ParentTabs for a missing/unknown role', () => {
    expect(navigatorForRole(null)).toBe('ParentTabs');
    expect(navigatorForRole(undefined)).toBe('ParentTabs');
  });
});

describe('tabSetForRole', () => {
  it('returns exactly the Parent tab set for a Stakeholder', () => {
    expect(tabSetForRole('Stakeholder')).toEqual([
      'Home',
      'Attendance',
      'Announcements',
      'Leave',
      'ParentProfile',
    ]);
  });

  it('returns exactly the Admin tab set for an Admin', () => {
    expect(tabSetForRole('Admin')).toEqual([
      'AdminDashboard',
      'AdminAttendance',
      'Management',
      'AdminProfile',
    ]);
  });

  it('returns exactly the SuperAdmin tab set for a SuperAdmin', () => {
    expect(tabSetForRole('SuperAdmin')).toEqual([
      'Platform',
      'Organizations',
      'SuperAdminAnalytics',
      'SuperAdminProfile',
    ]);
  });

  it('returns exactly the Teacher tab set for a Teacher', () => {
    expect(tabSetForRole('Teacher')).toEqual([
      'TeacherAttendance',
      'TeacherAnnouncements',
      'TeacherLeave',
      'TeacherStudents',
      'TeacherProfile',
    ]);
  });

  it('returns a fresh array (mutating the result cannot corrupt the source)', () => {
    const tabs = tabSetForRole('Admin') as string[];
    tabs.push('Hacked');
    expect(tabSetForRole('Admin')).not.toContain('Hacked');
    expect(ADMIN_TABS).not.toContain('Hacked' as never);
  });
});

describe('dashboardTabForRole', () => {
  it('points each role at its own dashboard/home tab', () => {
    expect(dashboardTabForRole('Stakeholder')).toBe('Home');
    expect(dashboardTabForRole('Admin')).toBe('AdminDashboard');
    expect(dashboardTabForRole('SuperAdmin')).toBe('Platform');
    expect(dashboardTabForRole('Teacher')).toBe('TeacherAttendance');
  });

  it('the dashboard tab is always a member of the role tab set', () => {
    (['Stakeholder', 'Admin', 'SuperAdmin', 'Teacher'] as AppRole[]).forEach((role) => {
      expect(tabSetForRole(role)).toContain(dashboardTabForRole(role));
    });
  });
});

describe('isNavigatorAllowedForRole', () => {
  it('allows only the matching navigator per role', () => {
    expect(isNavigatorAllowedForRole('AdminTabs', 'Admin')).toBe(true);
    expect(isNavigatorAllowedForRole('ParentTabs', 'Admin')).toBe(false);
    expect(isNavigatorAllowedForRole('SuperAdminTabs', 'Admin')).toBe(false);
    expect(isNavigatorAllowedForRole('TeacherTabs', 'Admin')).toBe(false);

    expect(isNavigatorAllowedForRole('ParentTabs', 'Stakeholder')).toBe(true);
    expect(isNavigatorAllowedForRole('SuperAdminTabs', 'SuperAdmin')).toBe(true);
    expect(isNavigatorAllowedForRole('TeacherTabs', 'Teacher')).toBe(true);
    expect(isNavigatorAllowedForRole('AdminTabs', 'Teacher')).toBe(false);
  });
});

describe('isTabAllowedForRole -- cross-role isolation', () => {
  it("rejects another role's tabs (Property 4 isolation)", () => {
    // An Admin tab is not reachable as a Parent, and vice-versa.
    expect(isTabAllowedForRole('AdminDashboard', 'Stakeholder')).toBe(false);
    expect(isTabAllowedForRole('Home', 'Admin')).toBe(false);
    expect(isTabAllowedForRole('Platform', 'Admin')).toBe(false);
    expect(isTabAllowedForRole('Organizations', 'Stakeholder')).toBe(false);
    // Teacher tabs are not reachable by Admin or Parent
    expect(isTabAllowedForRole('TeacherAttendance', 'Admin')).toBe(false);
    expect(isTabAllowedForRole('TeacherProfile', 'Stakeholder')).toBe(false);
    // Admin tabs are not reachable by Teacher
    expect(isTabAllowedForRole('AdminDashboard', 'Teacher')).toBe(false);
  });

  it("accepts every tab within the role's own set", () => {
    PARENT_TABS.forEach((t) =>
      expect(isTabAllowedForRole(t, 'Stakeholder')).toBe(true),
    );
    ADMIN_TABS.forEach((t) => expect(isTabAllowedForRole(t, 'Admin')).toBe(true));
    SUPER_ADMIN_TABS.forEach((t) =>
      expect(isTabAllowedForRole(t, 'SuperAdmin')).toBe(true),
    );
    TEACHER_TABS.forEach((t) =>
      expect(isTabAllowedForRole(t, 'Teacher')).toBe(true),
    );
  });
});

describe('visibleTeacherTabs -- permission-based filtering', () => {
  it('shows only Profile tab when no permissions are granted', () => {
    expect(visibleTeacherTabs([])).toEqual(['TeacherProfile']);
  });

  it('shows Attendance tab when mark_attendance permission is granted', () => {
    const tabs = visibleTeacherTabs(['mark_attendance']);
    expect(tabs).toContain('TeacherAttendance');
    expect(tabs).toContain('TeacherProfile');
  });

  it('shows all tabs when all relevant permissions are granted', () => {
    const tabs = visibleTeacherTabs([
      'mark_attendance',
      'create_announcements',
      'approve_leave_requests',
      'manage_students',
    ]);
    expect(tabs).toEqual([
      'TeacherAttendance',
      'TeacherAnnouncements',
      'TeacherLeave',
      'TeacherStudents',
      'TeacherProfile',
    ]);
  });

  it('shows Leave tab with view_leave_requests permission', () => {
    const tabs = visibleTeacherTabs(['view_leave_requests']);
    expect(tabs).toContain('TeacherLeave');
  });

  it('shows Announcements tab with publish_announcements permission', () => {
    const tabs = visibleTeacherTabs(['publish_announcements']);
    expect(tabs).toContain('TeacherAnnouncements');
  });
});
