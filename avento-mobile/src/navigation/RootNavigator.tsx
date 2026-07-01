/**
 * RootNavigator — top-level navigation + auth flow orchestration.
 *
 * Owns the {@link NavigationContainer} and decides, from auth-store state,
 * which top-level destination to render:
 *
 *   unauthenticated            → AuthStack (LoginScreen)        (Req 1.1)
 *   authenticated + biometric  → BiometricScreen gate           (Req 1.9)
 *   authenticated (verified)   → role-based tabs                (Req 1.4, 2.4)
 *
 * On mount it calls `restoreSession()` so a valid stored session bypasses the
 * login screen on launch (Requirement 1.4), showing a splash/loading state
 * while the restore and any silent refresh complete.
 *
 * The actual tab navigators (Parent/Admin/SuperAdmin) are owned by task 6.2;
 * lightweight placeholders are imported here so this layer is independently
 * testable. The role → tabs mapping treats the 'Stakeholder' role as Parent.
 *
 * The route-selection logic is factored into the pure, exported
 * {@link resolveRootRoute} / {@link tabsRouteForRole} helpers so it can be
 * unit-tested without rendering React Navigation.
 *
 * Push-notification deep-linking (task 15.1) is wired here too: the container
 * carries the shared {@link navigationRef} so notification taps can navigate
 * imperatively, foreground notification behavior is configured once, tap /
 * receipt listeners are subscribed for the navigator's lifetime, and the device
 * push token is registered once the user is authenticated (and unregistered on
 * the transition back to logged-out) (Requirements 22.1, 22.2, 22.3, 22.4).
 *
 * Validates: Requirements 1.1, 1.4, 1.9, 2.4, 22.1, 22.2, 22.3, 22.4
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, type NavigationState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';

import { useAuthStore } from '@/stores/auth';
import { pushNotifications } from '@/services/pushNotifications';
import type { AppRole } from '@/types/auth';
import type { RootStackParamList } from '@/types/navigation';

import { navigationRef, navigateToTarget } from './navigationRef';
import {
  loadNavigationState,
  persistNavigationState,
  clearNavigationState,
} from './navigationState';
import AuthStack from './AuthStack';
import BiometricScreen from '@/screens/auth/BiometricScreen';
// Real role-based tab navigators (task 6.2).
import AdminTabNavigator from './AdminTabNavigator';
import ParentTabNavigator from './ParentTabNavigator';
import SuperAdminTabNavigator from './SuperAdminTabNavigator';
import TeacherTabNavigator from './TeacherTabNavigator';

// ---------------------------------------------------------------------------
// Pure route-selection logic (exported for unit testing).
// ---------------------------------------------------------------------------

/** The top-level destinations the root navigator can land on. */
export type RootRoute =
  | 'Auth'
  | 'Biometric'
  | 'ParentTabs'
  | 'AdminTabs'
  | 'SuperAdminTabs'
  | 'TeacherTabs';

/**
 * Map a user role to its tab destination. The platform's 'Stakeholder' role is
 * the Parent experience. Unknown / missing roles fall back to the Parent tabs
 * (the least-privileged surface) rather than crashing.
 */
export function tabsRouteForRole(role: AppRole | null | undefined): RootRoute {
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
 * Decide the root destination from auth state.
 *
 * - Not authenticated → the auth stack.
 * - Authenticated but biometric login is enabled and not yet verified this
 *   session → the biometric gate.
 * - Otherwise → the role-appropriate tabs.
 */
export function resolveRootRoute(params: {
  isAuthenticated: boolean;
  biometricEnabled: boolean;
  biometricVerified: boolean;
  role: AppRole | null | undefined;
}): RootRoute {
  if (!params.isAuthenticated) {
    return 'Auth';
  }
  if (params.biometricEnabled && !params.biometricVerified) {
    return 'Biometric';
  }
  return tabsRouteForRole(params.role);
}

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role ?? null);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const logout = useAuthStore((s) => s.logout);

  // True until the initial session restore settles, so we can show a splash
  // instead of briefly flashing the login screen (Requirement 1.4).
  const [isRestoring, setIsRestoring] = useState(true);
  // True once the persisted navigation state has been loaded (or determined
  // absent). Gated together with `isRestoring` so the splash covers both async
  // loads before the navigator mounts.
  const [isNavStateReady, setIsNavStateReady] = useState(false);
  // The navigation state tree to restore, or undefined for a fresh start.
  const [initialNavState, setInitialNavState] = useState<
    NavigationState | undefined
  >(undefined);
  // Tracks whether the biometric gate has been passed this session.
  const [biometricVerified, setBiometricVerified] = useState(false);
  // Guards push-token registration so it happens once per authenticated
  // session rather than on every render where a token is present (Req 22.1).
  const pushRegisteredRef = useRef(false);
  // Guards cold-start deep-link handling so a notification that launched the
  // app from a killed state is routed exactly once, after the container mounts.
  const coldStartHandledRef = useRef(false);

  useEffect(() => {
    let active = true;
    void restoreSession().finally(() => {
      if (active) {
        setIsRestoring(false);
      }
    });
    return () => {
      active = false;
    };
  }, [restoreSession]);

  // Load persisted navigation state on mount.
  useEffect(() => {
    let active = true;
    void loadNavigationState().then((state) => {
      if (active) {
        setInitialNavState(state);
        setIsNavStateReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Wire push-notification deep-linking once for the navigator's lifetime:
  // route taps through the shared navigation ref, present foreground
  // notifications, and react to taps / receipts (Requirements 22.2, 22.3).
  useEffect(() => {
    pushNotifications.setNavigationHandler((target) => navigateToTarget(target));
    pushNotifications.configureForegroundBehavior();

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      pushNotifications.handleNotificationTapped,
    );
    const receivedSub = Notifications.addNotificationReceivedListener(
      pushNotifications.handleNotificationReceived,
    );

    return () => {
      responseSub.remove();
      receivedSub.remove();
      pushNotifications.setNavigationHandler(null);
    };
  }, []);

  // Register the device push token once the user is authenticated, and tear it
  // down on the transition back to logged-out. Idempotent via a ref so a token
  // refresh or re-render does not re-register (Requirements 22.1, 22.4).
  useEffect(() => {
    if (isAuthenticated && token && !pushRegisteredRef.current) {
      pushRegisteredRef.current = true;
      void pushNotifications.registerToken(token);
    } else if (!isAuthenticated && pushRegisteredRef.current) {
      pushRegisteredRef.current = false;
      void pushNotifications.unregister();
    }
  }, [isAuthenticated, token]);

  // Clear persisted navigation state when the user becomes unauthenticated,
  // and re-arm the biometric gate so a subsequent login prompts again.
  useEffect(() => {
    if (!isAuthenticated) {
      setBiometricVerified(false);
      void clearNavigationState();
    }
  }, [isAuthenticated]);

  const onFallback = useCallback(() => {
    void logout();
  }, [logout]);

  // Persist navigation state only while the user is authenticated — no point
  // storing the login-screen position (Requirement 23.5).
  const handleStateChange = useCallback(
    (state: NavigationState | undefined) => {
      if (state && isAuthenticated) {
        persistNavigationState(state);
      }
    },
    [isAuthenticated],
  );

  // Handle a notification that launched the app from a fully-killed state.
  // The tap listener only fires for warm/background apps, so on cold start we
  // must explicitly read the last notification response once the container is
  // ready and route it (only while authenticated, since deep-link targets live
  // inside the authenticated tabs). Runs at most once per launch.
  const handleNavigatorReady = useCallback(() => {
    if (coldStartHandledRef.current || !isAuthenticated) {
      return;
    }
    coldStartHandledRef.current = true;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        pushNotifications.handleNotificationTapped(response);
      }
    });
  }, [isAuthenticated]);

  if (isRestoring || isLoading || !isNavStateReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const route = resolveRootRoute({
    isAuthenticated,
    biometricEnabled,
    biometricVerified,
    role,
  });

  // The biometric gate is a standalone full-screen prompt rather than a routed
  // screen, so render it directly above the navigator.
  if (route === 'Biometric') {
    return (
      <BiometricScreen
        onAuthenticated={() => setBiometricVerified(true)}
        onFallback={onFallback}
      />
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={isAuthenticated ? initialNavState : undefined}
      onStateChange={handleStateChange}
      onReady={handleNavigatorReady}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {route === 'Auth' ? (
          <RootStack.Screen name="Auth" component={AuthStack} />
        ) : route === 'AdminTabs' ? (
          <RootStack.Screen name="AdminTabs" component={AdminTabNavigator} />
        ) : route === 'SuperAdminTabs' ? (
          <RootStack.Screen
            name="SuperAdminTabs"
            component={SuperAdminTabNavigator}
          />
        ) : route === 'TeacherTabs' ? (
          <RootStack.Screen
            name="TeacherTabs"
            component={TeacherTabNavigator}
          />
        ) : (
          <RootStack.Screen name="ParentTabs" component={ParentTabNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
