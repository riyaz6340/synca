/**
 * Push notification service for the Avento mobile app.
 *
 * Implements the {@link PushService} contract from the design doc
 * ("Push Notification Service Interface"). It wraps `expo-notifications` for
 * permission handling and Expo push-token retrieval, registers/unregisters the
 * device token with the Backend_API via the shared {@link apiClient}, and
 * routes notification taps to the correct screen via an *injectable* navigation
 * handler (wired by task 15.1, since navigation is not built yet).
 *
 * Design decisions:
 * - Navigation is decoupled through {@link setNavigationHandler} so this module
 *   never imports the navigator (avoids an import cycle and lets task 15.1
 *   connect a real navigation ref). Until a handler is registered, taps are a
 *   safe no-op.
 * - Deep-link routing is expressed as a pure, testable mapping
 *   ({@link resolveNavigationTarget}) from a notification `data` payload to a
 *   `{ screen, params }` target.
 * - Every public method degrades gracefully when permissions are denied or the
 *   platform lacks push capability: `requestPermissions` returns `false` and the
 *   remaining methods become no-ops instead of throwing (Requirement 22.4).
 *
 * Validates: Requirements 22.1, 22.2, 22.3, 22.4
 */

import * as Notifications from 'expo-notifications';
import type { Notification, NotificationResponse } from 'expo-notifications';

import { apiClient } from '../api/client';

/**
 * Backend endpoint that stores a device's Expo push token for the
 * authenticated user. Mounted under the existing `/api/push` router. Task 15.1
 * / backend may finalize the exact contract; kept as a constant so it is easy
 * to adjust in one place.
 */
export const PUSH_REGISTER_ENDPOINT = '/api/push/register-device';

/** Backend endpoint that removes the current device token (logout cleanup). */
export const PUSH_UNREGISTER_ENDPOINT = '/api/push/unregister-device';

/**
 * A resolved navigation instruction produced from a notification payload. The
 * `screen` values intentionally mirror the route names declared in
 * `src/types/navigation.ts` so task 15.1 can forward them straight to the
 * navigation container.
 */
export interface NavigationTarget {
  screen: string;
  params?: Record<string, unknown>;
}

/**
 * Callback invoked when a notification tap should move the user to a screen.
 * Injected via {@link setNavigationHandler}.
 */
export type NavigationHandler = (target: NavigationTarget) => void;

/** Injected navigation handler; `null` until task 15.1 wires the navigator. */
let navigationHandler: NavigationHandler | null = null;

/** Cached Expo push token for the current device/session. */
let cachedToken: string | null = null;

/**
 * Register the function used to perform navigation when a notification is
 * tapped. Passing `null` clears it (e.g. on teardown). Safe to call multiple
 * times — the most recent handler wins.
 */
export function setNavigationHandler(handler: NavigationHandler | null): void {
  navigationHandler = handler;
}

/**
 * Configure how notifications behave while the app is in the foreground. Called
 * once during app bootstrap so foreground notifications still present an alert.
 */
export function configureForegroundBehavior(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Pure mapping from a notification `data` payload to a navigation target.
 *
 * Supported payload `type` values:
 * - `attendance`    → `AttendanceHistory` (forwards `personId` / `personName`)
 * - `announcement`  → `AnnouncementDetail` (forwards `announcementId`)
 *
 * Returns `null` for unknown / missing types so callers can no-op safely.
 * Exported separately so the routing logic can be unit-tested without any
 * native modules or navigation.
 */
export function resolveNavigationTarget(
  data: Record<string, unknown> | undefined | null,
): NavigationTarget | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const type = typeof data.type === 'string' ? data.type : undefined;

  switch (type) {
    case 'attendance':
      return {
        screen: 'AttendanceHistory',
        params: {
          personId: data.personId ?? data.person_id,
          personName: data.personName ?? data.person_name,
        },
      };
    case 'announcement':
      return {
        screen: 'AnnouncementDetail',
        params: {
          announcementId: data.announcementId ?? data.announcement_id,
        },
      };
    default:
      return null;
  }
}

/**
 * Request the OS push-notification permission.
 *
 * Returns `true` only when permission is granted. When the user has already
 * granted it, no prompt is shown. When denied (or the request throws on an
 * unsupported platform), returns `false` so callers can degrade gracefully
 * (Requirement 22.4).
 */
export async function requestPermissions(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) {
      return true;
    }
    if (existing.canAskAgain === false) {
      return false;
    }
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    // Platform without push support, or a native failure — degrade gracefully.
    return false;
  }
}

/**
 * Acquire the Expo push token and POST it to the Backend_API for the
 * authenticated user.
 *
 * No-ops gracefully (without throwing) when permission is not granted or a
 * token cannot be obtained, so a denied-permission user never crashes the app
 * (Requirements 22.1, 22.4). The `authToken` is attached explicitly so the call
 * succeeds even before the API client's auth interceptor is configured (e.g.
 * during first login).
 */
export async function registerToken(authToken: string): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) {
    return;
  }

  let token: string | null;
  try {
    const result = await Notifications.getExpoPushTokenAsync();
    token = result?.data ?? null;
  } catch {
    // Token retrieval can fail on emulators / without FCM credentials.
    return;
  }

  if (!token) {
    return;
  }

  cachedToken = token;

  try {
    await apiClient.post(
      PUSH_REGISTER_ENDPOINT,
      { token, platform: 'android' },
      authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
    );
  } catch {
    // Registration failure is non-critical: push is a best-effort enhancement.
    // The token stays cached so a later retry / unregister can still use it.
  }
}

/**
 * Handle a notification delivered while the app is in the foreground.
 *
 * The OS does not automatically surface foreground notifications, so this hook
 * exists for any in-app side effects (badge counts, cache invalidation). It is
 * intentionally side-effect-light here and safe to call with any notification.
 */
export function handleNotificationReceived(notification: Notification): void {
  // Reserved for in-app reactions (e.g. badge refresh). Reading the payload is
  // guarded so a malformed notification can never throw.
  void notification?.request?.content?.data;
}

/**
 * Handle the user tapping a notification: resolve the target screen from the
 * payload and delegate to the injected navigation handler.
 *
 * No-ops when no handler is registered yet (navigation wired by task 15.1) or
 * when the payload does not map to a known screen.
 */
export function handleNotificationTapped(response: NotificationResponse): void {
  const data = response?.notification?.request?.content?.data as
    | Record<string, unknown>
    | undefined;

  const target = resolveNavigationTarget(data);
  if (target && navigationHandler) {
    navigationHandler(target);
  }
}

/**
 * Remove the device's push token from the Backend_API (logout cleanup).
 *
 * Best-effort: clears the local cache regardless of the network result and
 * never throws, so logout always proceeds even if the unregister call fails.
 */
export async function unregister(): Promise<void> {
  const token = cachedToken;
  cachedToken = null;

  if (!token) {
    return;
  }

  try {
    await apiClient.post(PUSH_UNREGISTER_ENDPOINT, { token });
  } catch {
    // Ignore — the token is already cleared locally and logout must proceed.
  }
}

/**
 * The push notification service object implementing the design's
 * {@link PushService} interface, plus the injectable navigation hook.
 */
export const pushNotifications = {
  requestPermissions,
  registerToken,
  handleNotificationReceived,
  handleNotificationTapped,
  unregister,
  setNavigationHandler,
  configureForegroundBehavior,
  resolveNavigationTarget,
};

export default pushNotifications;
