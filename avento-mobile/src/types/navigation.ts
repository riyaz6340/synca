/**
 * Navigation type definitions for the Avento mobile app.
 * Uses React Navigation typing patterns for type-safe navigation.
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

// ─── Auth Stack ──────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Biometric: undefined;
};

// ─── Parent Stacks ───────────────────────────────────────────────────────────

export type ParentHomeStackParamList = {
  ChildrenList: undefined;
};

export type ParentAttendanceStackParamList = {
  AttendanceHistory: { personId: string; personName: string };
  AttendanceCalendar: { personId: string; personName: string };
};

export type ParentAnnouncementsStackParamList = {
  AnnouncementList: undefined;
  AnnouncementDetail: { announcementId: string };
};

export type ParentLeaveStackParamList = {
  LeaveList: undefined;
  LeaveForm: { personId?: string } | undefined;
};

export type ParentProfileStackParamList = {
  Profile: undefined;
  ChangePassword: undefined;
  Notifications: undefined;
};

export type ParentTabsParamList = {
  Home: NavigatorScreenParams<ParentHomeStackParamList>;
  Attendance: NavigatorScreenParams<ParentAttendanceStackParamList>;
  Announcements: NavigatorScreenParams<ParentAnnouncementsStackParamList>;
  Leave: NavigatorScreenParams<ParentLeaveStackParamList>;
  ParentProfile: NavigatorScreenParams<ParentProfileStackParamList>;
};

// ─── Admin Stacks ────────────────────────────────────────────────────────────

export type AdminDashboardStackParamList = {
  Dashboard: undefined;
};

export type AdminAttendanceStackParamList = {
  GroupList: undefined;
  BulkMarking: { groupId: string; groupName: string };
};

export type AdminManagementStackParamList = {
  Students: undefined;
  StudentForm: { personId?: string } | undefined;
  Groups: undefined;
  GroupForm: { groupId?: string } | undefined;
  LeaveManagement: undefined;
  Announcements: undefined;
  AnnouncementForm: { announcementId?: string } | undefined;
  Reports: undefined;
  Holidays: undefined;
  HolidayForm: { holidayId?: string } | undefined;
  AuditLogs: undefined;
};

export type AdminProfileStackParamList = {
  Profile: undefined;
  ChangePassword: undefined;
};

export type AdminTabsParamList = {
  AdminDashboard: NavigatorScreenParams<AdminDashboardStackParamList>;
  AdminAttendance: NavigatorScreenParams<AdminAttendanceStackParamList>;
  Management: NavigatorScreenParams<AdminManagementStackParamList>;
  AdminProfile: NavigatorScreenParams<AdminProfileStackParamList>;
};

// ─── SuperAdmin Stacks ───────────────────────────────────────────────────────

export type SuperAdminPlatformStackParamList = {
  PlatformDashboard: undefined;
};

export type SuperAdminOrganizationsStackParamList = {
  OrgList: undefined;
  OrgForm: { orgId?: string } | undefined;
  OrgDetail: { orgId: string };
};

export type SuperAdminProfileStackParamList = {
  Profile: undefined;
  ChangePassword: undefined;
};

export type SuperAdminTabsParamList = {
  Platform: NavigatorScreenParams<SuperAdminPlatformStackParamList>;
  Organizations: NavigatorScreenParams<SuperAdminOrganizationsStackParamList>;
  SuperAdminProfile: NavigatorScreenParams<SuperAdminProfileStackParamList>;
};

// ─── Root Navigator ──────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  ParentTabs: NavigatorScreenParams<ParentTabsParamList>;
  AdminTabs: NavigatorScreenParams<AdminTabsParamList>;
  SuperAdminTabs: NavigatorScreenParams<SuperAdminTabsParamList>;
};

// ─── Declaration merging for useNavigation type safety ────────────────────────

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
