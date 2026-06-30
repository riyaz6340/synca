/**
 * ParentTabNavigator — the Parent (Stakeholder) bottom-tab navigator.
 *
 * Five tabs, each backed by its own native-stack so pushes animate with the
 * platform slide-from-right transition (Requirement 2.4):
 *
 *   Home          → ChildrenList
 *   Attendance    → AttendanceHistory, AttendanceCalendar
 *   Announcements → AnnouncementList, AnnouncementDetail
 *   Leave         → LeaveList, LeaveForm
 *   Profile       → Profile, ChangePassword, Notifications
 *
 * Screen components are the real Parent screens (tasks 9.x). The only remaining
 * placeholder is AttendanceCalendar, which has no real screen yet.
 *
 * A render-time role guard (Requirement 2.5) ensures that if this navigator is
 * ever mounted for a non-Parent role it redirects to that role's own dashboard
 * via {@link RoleRedirect}, rather than exposing Parent screens.
 *
 * Validates: Requirements 2.1, 2.4, 2.5
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import { useUnseenAnnouncementCount } from '@/hooks/useAnnouncements';
import AnnouncementDetailScreen from '@/screens/parent/AnnouncementDetailScreen';
import AnnouncementListScreen from '@/screens/parent/AnnouncementListScreen';
import AttendanceHistoryScreen from '@/screens/parent/AttendanceHistoryScreen';
import ChildSelectScreen from '@/screens/parent/ChildSelectScreen';
import HomeScreen from '@/screens/parent/HomeScreen';
import LeaveFormScreen from '@/screens/parent/LeaveFormScreen';
import LeaveListScreen from '@/screens/parent/LeaveListScreen';
import NotificationsScreen from '@/screens/parent/NotificationsScreen';
import ChangePasswordScreen from '@/screens/shared/ChangePasswordScreen';
import ProfileScreen from '@/screens/shared/ProfileScreen';
import { useAuthStore } from '@/stores/auth';
import type {
  ParentAnnouncementsStackParamList,
  ParentAttendanceStackParamList,
  ParentHomeStackParamList,
  ParentLeaveStackParamList,
  ParentProfileStackParamList,
  ParentTabsParamList,
} from '@/types/navigation';

import { makePlaceholderScreen } from './placeholders';
import RoleRedirect from './RoleRedirect';
import { isNavigatorAllowedForRole } from './roleGuard';

// The Home tab's ChildrenList route is backed by the real HomeScreen.
const ChildrenListScreen = HomeScreen;

// AttendanceCalendar has no real screen yet — keep a placeholder for now.
const AttendanceCalendarScreen = makePlaceholderScreen('AttendanceCalendar');

// --- Per-tab native stacks --------------------------------------------------

const HomeStack = createNativeStackNavigator<ParentHomeStackParamList>();
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        name="ChildrenList"
        component={ChildrenListScreen}
        options={{ title: 'My Children' }}
      />
    </HomeStack.Navigator>
  );
}

const AttendanceStack =
  createNativeStackNavigator<ParentAttendanceStackParamList>();
function AttendanceStackNavigator() {
  return (
    <AttendanceStack.Navigator initialRouteName="ChildSelect">
      <AttendanceStack.Screen
        name="ChildSelect"
        component={ChildSelectScreen}
        options={{ title: 'Attendance' }}
      />
      <AttendanceStack.Screen
        name="AttendanceHistory"
        component={AttendanceHistoryScreen}
        options={{ title: 'History' }}
      />
      <AttendanceStack.Screen
        name="AttendanceCalendar"
        component={AttendanceCalendarScreen}
        options={{ title: 'Calendar' }}
      />
    </AttendanceStack.Navigator>
  );
}

const AnnouncementsStack =
  createNativeStackNavigator<ParentAnnouncementsStackParamList>();
function AnnouncementsStackNavigator() {
  return (
    <AnnouncementsStack.Navigator>
      <AnnouncementsStack.Screen
        name="AnnouncementList"
        component={AnnouncementListScreen}
        options={{ title: 'Announcements' }}
      />
      <AnnouncementsStack.Screen
        name="AnnouncementDetail"
        component={AnnouncementDetailScreen}
        options={{ title: 'Announcement' }}
      />
    </AnnouncementsStack.Navigator>
  );
}

const LeaveStack = createNativeStackNavigator<ParentLeaveStackParamList>();
function LeaveStackNavigator() {
  return (
    <LeaveStack.Navigator>
      <LeaveStack.Screen
        name="LeaveList"
        component={LeaveListScreen}
        options={{ title: 'Leave Requests' }}
      />
      <LeaveStack.Screen
        name="LeaveForm"
        component={LeaveFormScreen}
        options={{ title: 'New Leave Request' }}
      />
    </LeaveStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator<ParentProfileStackParamList>();
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
      <ProfileStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </ProfileStack.Navigator>
  );
}

// --- Bottom tabs ------------------------------------------------------------

const Tab = createBottomTabNavigator<ParentTabsParamList>();

/** Simple emoji tab icon — avoids adding a vector-icon dependency. */
function tabIcon(glyph: string) {
  return function TabBarIcon() {
    return <Text style={{ fontSize: 20 }}>{glyph}</Text>;
  };
}

function ParentTabs() {
  const unseenAnnouncements = useUnseenAnnouncementCount();

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{ title: 'Home', tabBarIcon: tabIcon('🏠') }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceStackNavigator}
        options={{ title: 'Attendance', tabBarIcon: tabIcon('📅') }}
      />
      <Tab.Screen
        name="Announcements"
        component={AnnouncementsStackNavigator}
        options={{
          title: 'News',
          tabBarIcon: tabIcon('📣'),
          // Show the unread-announcement count as a tab badge (Req 5.4).
          tabBarBadge: unseenAnnouncements > 0 ? unseenAnnouncements : undefined,
        }}
      />
      <Tab.Screen
        name="Leave"
        component={LeaveStackNavigator}
        options={{ title: 'Leave', tabBarIcon: tabIcon('📝') }}
      />
      <Tab.Screen
        name="ParentProfile"
        component={ProfileStackNavigator}
        options={{ title: 'Profile', tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}

export default function ParentTabNavigator() {
  const role = useAuthStore((s) => s.user?.role ?? null);

  // Role guard (Req 2.5): if mounted for a non-Parent role, redirect to that
  // role's own dashboard instead of exposing Parent screens.
  if (!isNavigatorAllowedForRole('ParentTabs', role)) {
    return <RoleRedirect role={role} />;
  }

  return <ParentTabs />;
}
