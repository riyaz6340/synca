/**
 * TeacherTabNavigator — the Teacher bottom-tab navigator.
 *
 * Tabs are shown/hidden based on the Teacher's granted permissions:
 *
 *   Attendance    → GroupList, BulkMarking  (requires mark_attendance or view_attendance_reports)
 *   Announcements → Announcements, AnnouncementForm  (requires create_announcements or publish_announcements)
 *   Leave         → LeaveManagement  (requires approve_leave_requests or view_leave_requests)
 *   Students      → Students, StudentForm  (requires manage_students)
 *   Profile       → Profile, ChangePassword  (always visible)
 *
 * Permission-based filtering uses {@link visibleTeacherTabs} from roleGuard,
 * which computes visible tabs from the user's granted permissions. A Teacher
 * with no permissions sees only the Profile tab.
 *
 * A render-time role guard (Requirement 2.5) redirects a non-Teacher mount to
 * that role's own dashboard via {@link RoleRedirect}.
 *
 * Validates: Requirements 1.6, 11.7
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import AnnouncementFormScreen from '@/screens/admin/AnnouncementFormScreen';
import AnnouncementsScreen from '@/screens/admin/AnnouncementsScreen';
import BulkMarkingScreen from '@/screens/admin/BulkMarkingScreen';
import LeaveManagementScreen from '@/screens/admin/LeaveManagementScreen';
import StudentFormScreen from '@/screens/admin/StudentFormScreen';
import StudentsScreen from '@/screens/admin/StudentsScreen';
import AttendanceCalendarScreen from '@/screens/attendance/AttendanceCalendarScreen';
import AttendanceModeScreen from '@/screens/attendance/AttendanceModeScreen';
import AttendanceSummaryScreen from '@/screens/attendance/AttendanceSummaryScreen';
import SequentialAttendanceScreen from '@/screens/attendance/SequentialAttendanceScreen';
import ChangePasswordScreen from '@/screens/shared/ChangePasswordScreen';
import ProfileScreen from '@/screens/shared/ProfileScreen';
import TeacherGroupListScreen from '@/screens/teacher/TeacherGroupListScreen';
import { withPermissionGate } from '@/components/withPermissionGate';
import { useAuthStore } from '@/stores/auth';
import type {
  TeacherAnnouncementsStackParamList,
  TeacherAttendanceStackParamList,
  TeacherLeaveStackParamList,
  TeacherProfileStackParamList,
  TeacherStudentsStackParamList,
  TeacherTabsParamList,
} from '@/types/navigation';

import RoleRedirect from './RoleRedirect';
import { isNavigatorAllowedForRole, visibleTeacherTabs } from './roleGuard';
import type { TeacherTabName } from './roleGuard';

// --- Permission-gated screen wrappers ----------------------------------------

const GatedAnnouncementsScreen = withPermissionGate(AnnouncementsScreen, 'create_announcements');
const GatedAnnouncementFormScreen = withPermissionGate(AnnouncementFormScreen, 'create_announcements');
const GatedLeaveManagementScreen = withPermissionGate(LeaveManagementScreen, 'approve_leave_requests');
const GatedStudentsScreen = withPermissionGate(StudentsScreen, 'manage_students');
const GatedStudentFormScreen = withPermissionGate(StudentFormScreen, 'manage_students');

// --- Per-tab native stacks --------------------------------------------------

const AttendanceStack =
  createNativeStackNavigator<TeacherAttendanceStackParamList>();
function AttendanceStackNavigator() {
  return (
    <AttendanceStack.Navigator>
      <AttendanceStack.Screen
        name="GroupList"
        component={TeacherGroupListScreen}
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

const AnnouncementsStack =
  createNativeStackNavigator<TeacherAnnouncementsStackParamList>();
function AnnouncementsStackNavigator() {
  return (
    <AnnouncementsStack.Navigator>
      <AnnouncementsStack.Screen
        name="Announcements"
        component={GatedAnnouncementsScreen}
        options={{ title: 'Announcements' }}
      />
      <AnnouncementsStack.Screen
        name="AnnouncementForm"
        component={GatedAnnouncementFormScreen}
        options={{ title: 'Announcement' }}
      />
    </AnnouncementsStack.Navigator>
  );
}

const LeaveStack = createNativeStackNavigator<TeacherLeaveStackParamList>();
function LeaveStackNavigator() {
  return (
    <LeaveStack.Navigator>
      <LeaveStack.Screen
        name="LeaveManagement"
        component={GatedLeaveManagementScreen}
        options={{ title: 'Leave Requests' }}
      />
    </LeaveStack.Navigator>
  );
}

const StudentsStack =
  createNativeStackNavigator<TeacherStudentsStackParamList>();
function StudentsStackNavigator() {
  return (
    <StudentsStack.Navigator>
      <StudentsStack.Screen
        name="Students"
        component={GatedStudentsScreen}
        options={{ title: 'Students' }}
      />
      <StudentsStack.Screen
        name="StudentForm"
        component={GatedStudentFormScreen}
        options={{ title: 'Student' }}
      />
    </StudentsStack.Navigator>
  );
}

const ProfileStack =
  createNativeStackNavigator<TeacherProfileStackParamList>();
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

// --- Tab → component mapping ------------------------------------------------

const TAB_COMPONENTS: Record<TeacherTabName, () => JSX.Element> = {
  TeacherAttendance: AttendanceStackNavigator,
  TeacherAnnouncements: AnnouncementsStackNavigator,
  TeacherLeave: LeaveStackNavigator,
  TeacherStudents: StudentsStackNavigator,
  TeacherProfile: ProfileStackNavigator,
};

const TAB_CONFIG: Record<TeacherTabName, { title: string; icon: string }> = {
  TeacherAttendance: { title: 'Attendance', icon: '✅' },
  TeacherAnnouncements: { title: 'Announce', icon: '📣' },
  TeacherLeave: { title: 'Leave', icon: '📋' },
  TeacherStudents: { title: 'Students', icon: '🎓' },
  TeacherProfile: { title: 'Profile', icon: '👤' },
};

// --- Bottom tabs ------------------------------------------------------------

const Tab = createBottomTabNavigator<TeacherTabsParamList>();

/** Simple emoji tab icon — avoids adding a vector-icon dependency. */
function tabIcon(glyph: string) {
  return function TabBarIcon() {
    return <Text style={{ fontSize: 20 }}>{glyph}</Text>;
  };
}

function TeacherTabs() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const tabs = visibleTeacherTabs(permissions);

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      {tabs.map((tabName) => (
        <Tab.Screen
          key={tabName}
          name={tabName}
          component={TAB_COMPONENTS[tabName]}
          options={{
            title: TAB_CONFIG[tabName].title,
            tabBarIcon: tabIcon(TAB_CONFIG[tabName].icon),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function TeacherTabNavigator() {
  const role = useAuthStore((s) => s.user?.role ?? null);

  // Role guard (Req 2.5): if mounted for a non-Teacher role, redirect to that
  // role's own dashboard instead of exposing Teacher screens.
  if (!isNavigatorAllowedForRole('TeacherTabs', role)) {
    return <RoleRedirect role={role} />;
  }

  return <TeacherTabs />;
}
