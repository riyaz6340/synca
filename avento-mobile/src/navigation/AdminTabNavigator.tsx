/**
 * AdminTabNavigator — the Admin bottom-tab navigator.
 *
 * Four tabs, each backed by its own native-stack for animated transitions
 * (Requirement 2.4):
 *
 *   Dashboard  → Dashboard
 *   Attendance → GroupList, BulkMarking
 *   Management → Students, StudentForm, Groups, GroupForm, LeaveManagement,
 *                Announcements, AnnouncementForm, Reports, Holidays,
 *                HolidayForm, AuditLogs
 *   Profile    → Profile, ChangePassword
 *
 * Screen components are the real Admin screens (tasks 11.x–12.x). A render-time
 * role guard (Requirement 2.5) redirects a non-Admin mount to that role's own
 * dashboard via {@link RoleRedirect}.
 *
 * Validates: Requirements 2.2, 2.4, 2.5
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import AnnouncementFormScreen from '@/screens/admin/AnnouncementFormScreen';
import AnnouncementsScreen from '@/screens/admin/AnnouncementsScreen';
import AuditLogsScreen from '@/screens/admin/AuditLogsScreen';
import BulkMarkingScreen from '@/screens/admin/BulkMarkingScreen';
import DashboardScreen from '@/screens/admin/DashboardScreen';
import GroupFormScreen from '@/screens/admin/GroupFormScreen';
import GroupListScreen from '@/screens/admin/GroupListScreen';
import GroupsScreen from '@/screens/admin/GroupsScreen';
import HolidayFormScreen from '@/screens/admin/HolidayFormScreen';
import HolidaysScreen from '@/screens/admin/HolidaysScreen';
import LeaveManagementScreen, {
  usePendingLeaveCount,
} from '@/screens/admin/LeaveManagementScreen';
import ReportsScreen from '@/screens/admin/ReportsScreen';
import StudentFormScreen from '@/screens/admin/StudentFormScreen';
import StudentsScreen from '@/screens/admin/StudentsScreen';
import AttendanceCalendarScreen from '@/screens/attendance/AttendanceCalendarScreen';
import AttendanceModeScreen from '@/screens/attendance/AttendanceModeScreen';
import AttendanceSummaryScreen from '@/screens/attendance/AttendanceSummaryScreen';
import SequentialAttendanceScreen from '@/screens/attendance/SequentialAttendanceScreen';
import ChangePasswordScreen from '@/screens/shared/ChangePasswordScreen';
import ProfileScreen from '@/screens/shared/ProfileScreen';
import { useAuthStore } from '@/stores/auth';
import type {
  AdminAttendanceStackParamList,
  AdminDashboardStackParamList,
  AdminManagementStackParamList,
  AdminProfileStackParamList,
  AdminTabsParamList,
} from '@/types/navigation';

import RoleRedirect from './RoleRedirect';
import { isNavigatorAllowedForRole } from './roleGuard';
import { makePlaceholderScreen } from './placeholders';

// --- Per-tab native stacks --------------------------------------------------

const DashboardStack =
  createNativeStackNavigator<AdminDashboardStackParamList>();
function DashboardStackNavigator() {
  return (
    <DashboardStack.Navigator>
      <DashboardStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
    </DashboardStack.Navigator>
  );
}

const AttendanceStack =
  createNativeStackNavigator<AdminAttendanceStackParamList>();
function AttendanceStackNavigator() {
  return (
    <AttendanceStack.Navigator>
      <AttendanceStack.Screen
        name="GroupList"
        component={GroupListScreen}
        options={{ title: 'Mark Attendance' }}
      />
      <AttendanceStack.Screen
        name="AttendanceCalendar"
        component={AttendanceCalendarScreen}
        options={{ title: 'Attendance Calendar' }}
      />
      <AttendanceStack.Screen
        name="AttendanceMode"
        component={AttendanceModeScreen}
        options={{ title: 'Choose Mode' }}
      />
      <AttendanceStack.Screen
        name="BulkMarking"
        component={BulkMarkingScreen}
        options={{ title: 'Mark Group' }}
      />
      <AttendanceStack.Screen
        name="SequentialAttendance"
        component={SequentialAttendanceScreen}
        options={{ title: 'Sequential Marking' }}
      />
      <AttendanceStack.Screen
        name="AttendanceSummary"
        component={AttendanceSummaryScreen}
        options={{ title: 'Attendance Summary' }}
      />
    </AttendanceStack.Navigator>
  );
}

const ManagementStack =
  createNativeStackNavigator<AdminManagementStackParamList>();
function ManagementStackNavigator() {
  return (
    <ManagementStack.Navigator>
      <ManagementStack.Screen
        name="Students"
        component={StudentsScreen}
        options={{ title: 'Students' }}
      />
      <ManagementStack.Screen
        name="StudentForm"
        component={StudentFormScreen}
        options={{ title: 'Student' }}
      />
      <ManagementStack.Screen
        name="Groups"
        component={GroupsScreen}
        options={{ title: 'Groups' }}
      />
      <ManagementStack.Screen
        name="GroupForm"
        component={GroupFormScreen}
        options={{ title: 'Group' }}
      />
      <ManagementStack.Screen
        name="LeaveManagement"
        component={LeaveManagementScreen}
        options={{ title: 'Leave Requests' }}
      />
      <ManagementStack.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{ title: 'Announcements' }}
      />
      <ManagementStack.Screen
        name="AnnouncementForm"
        component={AnnouncementFormScreen}
        options={{ title: 'Announcement' }}
      />
      <ManagementStack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Reports' }}
      />
      <ManagementStack.Screen
        name="Holidays"
        component={HolidaysScreen}
        options={{ title: 'Holidays' }}
      />
      <ManagementStack.Screen
        name="HolidayForm"
        component={HolidayFormScreen}
        options={{ title: 'Holiday' }}
      />
      <ManagementStack.Screen
        name="AuditLogs"
        component={AuditLogsScreen}
        options={{ title: 'Audit Logs' }}
      />
    </ManagementStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator<AdminProfileStackParamList>();
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <ProfileStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Change Password' }}
      />
    </ProfileStack.Navigator>
  );
}

// --- Bottom tabs ------------------------------------------------------------

const Tab = createBottomTabNavigator<AdminTabsParamList>();

/** Simple emoji tab icon — avoids adding a vector-icon dependency. */
function tabIcon(glyph: string) {
  return function TabBarIcon() {
    return <Text style={{ fontSize: 20 }}>{glyph}</Text>;
  };
}

function AdminTabs() {
  const pendingLeave = usePendingLeaveCount();

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="AdminDashboard"
        component={DashboardStackNavigator}
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('📊') }}
      />
      <Tab.Screen
        name="AdminAttendance"
        component={AttendanceStackNavigator}
        options={{ title: 'Attendance', tabBarIcon: tabIcon('✅') }}
      />
      <Tab.Screen
        name="Management"
        component={ManagementStackNavigator}
        options={{
          title: 'Manage',
          tabBarIcon: tabIcon('🗂️'),
          // Surface the pending-leave count as a tab badge (Req 13.5).
          tabBarBadge: pendingLeave > 0 ? pendingLeave : undefined,
        }}
      />
      <Tab.Screen
        name="AdminProfile"
        component={ProfileStackNavigator}
        options={{ title: 'Profile', tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}

export default function AdminTabNavigator() {
  const role = useAuthStore((s) => s.user?.role ?? null);

  // Role guard (Req 2.5): if mounted for a non-Admin role, redirect to that
  // role's own dashboard instead of exposing Admin screens.
  if (!isNavigatorAllowedForRole('AdminTabs', role)) {
    return <RoleRedirect role={role} />;
  }

  return <AdminTabs />;
}
