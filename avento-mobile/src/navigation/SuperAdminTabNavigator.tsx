/**
 * SuperAdminTabNavigator — the SuperAdmin bottom-tab navigator.
 *
 * Three tabs, each backed by its own native-stack for animated transitions
 * (Requirement 2.4):
 *
 *   Platform      → PlatformDashboard
 *   Organizations → OrgList, OrgForm, OrgDetail
 *   Profile       → Profile, ChangePassword
 *
 * A render-time role guard (Requirement 2.5) redirects a non-SuperAdmin mount
 * to that role's own dashboard via {@link RoleRedirect}.
 *
 * Validates: Requirements 2.3, 2.4, 2.5
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import ChangePasswordScreen from '@/screens/shared/ChangePasswordScreen';
import ProfileScreen from '@/screens/shared/ProfileScreen';
import AnalyticsScreen from '@/screens/superadmin/AnalyticsScreen';
import OrgDetailScreen from '@/screens/superadmin/OrgDetailScreen';
import OrgFormScreen from '@/screens/superadmin/OrgFormScreen';
import OrgListScreen from '@/screens/superadmin/OrgListScreen';
import PlatformDashboardScreen from '@/screens/superadmin/PlatformDashboardScreen';
import { useAuthStore } from '@/stores/auth';
import type {
  SuperAdminAnalyticsStackParamList,
  SuperAdminOrganizationsStackParamList,
  SuperAdminPlatformStackParamList,
  SuperAdminProfileStackParamList,
  SuperAdminTabsParamList,
} from '@/types/navigation';

import RoleRedirect from './RoleRedirect';
import { isNavigatorAllowedForRole } from './roleGuard';

// --- Per-tab native stacks --------------------------------------------------

const PlatformStack =
  createNativeStackNavigator<SuperAdminPlatformStackParamList>();
function PlatformStackNavigator() {
  return (
    <PlatformStack.Navigator>
      <PlatformStack.Screen
        name="PlatformDashboard"
        component={PlatformDashboardScreen}
        options={{ title: 'Platform' }}
      />
    </PlatformStack.Navigator>
  );
}

const OrganizationsStack =
  createNativeStackNavigator<SuperAdminOrganizationsStackParamList>();
function OrganizationsStackNavigator() {
  return (
    <OrganizationsStack.Navigator>
      <OrganizationsStack.Screen
        name="OrgList"
        component={OrgListScreen}
        options={{ title: 'Organizations' }}
      />
      <OrganizationsStack.Screen
        name="OrgForm"
        component={OrgFormScreen}
        options={{ title: 'Organization' }}
      />
      <OrganizationsStack.Screen
        name="OrgDetail"
        component={OrgDetailScreen}
        options={{ title: 'Details' }}
      />
    </OrganizationsStack.Navigator>
  );
}

const ProfileStack =
  createNativeStackNavigator<SuperAdminProfileStackParamList>();
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

const AnalyticsStack =
  createNativeStackNavigator<SuperAdminAnalyticsStackParamList>();
function AnalyticsStackNavigator() {
  return (
    <AnalyticsStack.Navigator>
      <AnalyticsStack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: 'Analytics' }}
      />
    </AnalyticsStack.Navigator>
  );
}

// --- Bottom tabs ------------------------------------------------------------

const Tab = createBottomTabNavigator<SuperAdminTabsParamList>();

/** Simple emoji tab icon — avoids adding a vector-icon dependency. */
function tabIcon(glyph: string) {
  return function TabBarIcon() {
    return <Text style={{ fontSize: 20 }}>{glyph}</Text>;
  };
}

function SuperAdminTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Platform"
        component={PlatformStackNavigator}
        options={{ title: 'Platform', tabBarIcon: tabIcon('🌐') }}
      />
      <Tab.Screen
        name="Organizations"
        component={OrganizationsStackNavigator}
        options={{ title: 'Orgs', tabBarIcon: tabIcon('🏢') }}
      />
      <Tab.Screen
        name="SuperAdminAnalytics"
        component={AnalyticsStackNavigator}
        options={{ title: 'Analytics', tabBarIcon: tabIcon('📊') }}
      />
      <Tab.Screen
        name="SuperAdminProfile"
        component={ProfileStackNavigator}
        options={{ title: 'Profile', tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}

export default function SuperAdminTabNavigator() {
  const role = useAuthStore((s) => s.user?.role ?? null);

  // Role guard (Req 2.5): if mounted for a non-SuperAdmin role, redirect to
  // that role's own dashboard instead of exposing SuperAdmin screens.
  if (!isNavigatorAllowedForRole('SuperAdminTabs', role)) {
    return <RoleRedirect role={role} />;
  }

  return <SuperAdminTabs />;
}
