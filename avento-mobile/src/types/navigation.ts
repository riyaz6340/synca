/**
 * Navigation type definitions for the Arixx mobile app.
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
  ChildSelect: undefined;
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
  AttendanceCalendar: undefined;
  AttendanceMode: { groupId: string; groupName: string };
  BulkMarking: { groupId: string; groupName: string };
  SequentialAttendance: { groupId: string; groupName: string };
  AttendanceSummary: { groupId: string; groupName: string; marks: string };
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

export type SuperAdminAnalyticsStackParamList = {
  Analytics: undefined;
};

export type SuperAdminProfileStackParamList = {
  Profile: undefined;
  ChangePassword: undefined;
};

export type SuperAdminTabsParamList = {
  Platform: NavigatorScreenParams<SuperAdminPlatformStackParamList>;
  Organizations: NavigatorScreenParams<SuperAdminOrganizationsStackParamList>;
  SuperAdminAnalytics: NavigatorScreenParams<SuperAdminAnalyticsStackParamList>;
  SuperAdminProfile: NavigatorScreenParams<SuperAdminProfileStackParamList>;
};

// ─── Teacher Stacks ──────────────────────────────────────────────────────────

export type TeacherAttendanceStackParamList = {
  GroupList: undefined;
  AttendanceCalendar: undefined;
  AttendanceMode: { groupId: string; groupName: string };
  BulkMarking: { groupId: string; groupName: string };
  SequentialAttendance: { groupId: string; groupName: string };
  AttendanceSummary: { groupId: string; groupName: string; marks: string };
};

export type TeacherAnnouncementsStackParamList = {
  Announcements: undefined;
  AnnouncementForm: { announcementId?: string } | undefined;
};

export type TeacherLeaveStackParamList = {
  LeaveManagement: undefined;
};

export type TeacherStudentsStackParamList = {
  Students: undefined;
  StudentForm: { personId?: string } | undefined;
};

export type TeacherProfileStackParamList = {
  Profile: undefined;
  ChangePassword: undefined;
};

export type TeacherTabsParamList = {
  TeacherAttendance: NavigatorScreenParams<TeacherAttendanceStackParamList>;
  TeacherAnnouncements: NavigatorScreenParams<TeacherAnnouncementsStackParamList>;
  TeacherLeave: NavigatorScreenParams<TeacherLeaveStackParamList>;
  TeacherStudents: NavigatorScreenParams<TeacherStudentsStackParamList>;
  TeacherProfile: NavigatorScreenParams<TeacherProfileStackParamList>;
};

// ─── Root Navigator ──────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  ParentTabs: NavigatorScreenParams<ParentTabsParamList>;
  AdminTabs: NavigatorScreenParams<AdminTabsParamList>;
  SuperAdminTabs: NavigatorScreenParams<SuperAdminTabsParamList>;
  TeacherTabs: NavigatorScreenParams<TeacherTabsParamList>;
};

// ─── Declaration merging for useNavigation type safety ────────────────────────

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
