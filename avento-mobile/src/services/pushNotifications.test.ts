/**
 * Unit tests for the push notification service.
 *
 * `expo-notifications` and the shared `apiClient` are mocked so permission
 * handling, token registration, deep-link routing, and graceful degradation
 * can be verified without native modules or network access.
 *
 * Validates: Requirements 22.1, 22.2, 22.3, 22.4
 */

import * as Notifications from 'expo-notifications';

import { apiClient } from '../api/client';
import {
  PUSH_REGISTER_ENDPOINT,
  PUSH_UNREGISTER_ENDPOINT,
  requestPermissions,
  registerToken,
  handleNotificationTapped,
  handleNotificationReceived,
  resolveNavigationTarget,
  setNavigationHandler,
  unregister,
} from './pushNotifications';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

jest.mock('../api/client', () => ({
  apiClient: { post: jest.fn() },
}));

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockPost = apiClient.post as jest.Mock;

const granted = { granted: true, canAskAgain: true, status: 'granted' };
const denied = { granted: false, canAskAgain: true, status: 'denied' };
const blocked = { granted: false, canAskAgain: false, status: 'denied' };

beforeEach(() => {
  setNavigationHandler(null);
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: {} });
});

/** Build a minimal NotificationResponse with the given data payload. */
function responseWith(data: Record<string, unknown>) {
  return {
    notification: { request: { content: { data } } },
  } as unknown as Notifications.NotificationResponse;
}

describe('requestPermissions', () => {
  it('returns true immediately when permission is already granted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(granted as never);

    await expect(requestPermissions()).resolves.toBe(true);
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('prompts and returns true when the user grants permission', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(denied as never);
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce(granted as never);

    await expect(requestPermissions()).resolves.toBe(true);
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('returns false when the user denies permission', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(denied as never);
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce(denied as never);

    await expect(requestPermissions()).resolves.toBe(false);
  });

  it('does not re-prompt when permission is permanently blocked', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(blocked as never);

    await expect(requestPermissions()).resolves.toBe(false);
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('degrades to false (no throw) when the native call fails', async () => {
    mockNotifications.getPermissionsAsync.mockRejectedValueOnce(new Error('unsupported'));

    await expect(requestPermissions()).resolves.toBe(false);
  });
});

describe('registerToken', () => {
  it('posts the Expo token to the backend with the auth header when granted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(granted as never);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValueOnce({
      data: 'ExponentPushToken[abc]',
    } as never);

    await registerToken('jwt-123');

    expect(mockPost).toHaveBeenCalledWith(
      PUSH_REGISTER_ENDPOINT,
      { token: 'ExponentPushToken[abc]', platform: 'android' },
      { headers: { Authorization: 'Bearer jwt-123' } },
    );
  });

  it('does not register or fetch a token when permission is denied (graceful)', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(denied as never);
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce(denied as never);

    await registerToken('jwt-123');

    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('no-ops when the token cannot be obtained', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(granted as never);
    mockNotifications.getExpoPushTokenAsync.mockRejectedValueOnce(new Error('no FCM'));

    await expect(registerToken('jwt-123')).resolves.toBeUndefined();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('does not throw when the backend registration fails', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(granted as never);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValueOnce({
      data: 'ExponentPushToken[xyz]',
    } as never);
    mockPost.mockRejectedValueOnce(new Error('500'));

    await expect(registerToken('jwt-123')).resolves.toBeUndefined();
  });
});

describe('resolveNavigationTarget', () => {
  it('routes attendance notifications to AttendanceHistory', () => {
    expect(
      resolveNavigationTarget({ type: 'attendance', personId: 'p1', personName: 'Ann' }),
    ).toEqual({
      screen: 'AttendanceHistory',
      params: { personId: 'p1', personName: 'Ann' },
    });
  });

  it('routes announcement notifications to AnnouncementDetail', () => {
    expect(resolveNavigationTarget({ type: 'announcement', announcementId: 'a1' })).toEqual({
      screen: 'AnnouncementDetail',
      params: { announcementId: 'a1' },
    });
  });

  it('supports snake_case payload keys', () => {
    expect(
      resolveNavigationTarget({ type: 'attendance', person_id: 'p9', person_name: 'Bob' }),
    ).toEqual({
      screen: 'AttendanceHistory',
      params: { personId: 'p9', personName: 'Bob' },
    });
  });

  it('returns null for unknown or missing types', () => {
    expect(resolveNavigationTarget({ type: 'mystery' })).toBeNull();
    expect(resolveNavigationTarget({})).toBeNull();
    expect(resolveNavigationTarget(null)).toBeNull();
    expect(resolveNavigationTarget(undefined)).toBeNull();
  });
});

describe('handleNotificationTapped', () => {
  it('invokes the navigation handler with the resolved target', () => {
    const handler = jest.fn();
    setNavigationHandler(handler);

    handleNotificationTapped(responseWith({ type: 'announcement', announcementId: 'a1' }));

    expect(handler).toHaveBeenCalledWith({
      screen: 'AnnouncementDetail',
      params: { announcementId: 'a1' },
    });
  });

  it('no-ops when no navigation handler is registered', () => {
    expect(() =>
      handleNotificationTapped(responseWith({ type: 'attendance', personId: 'p1' })),
    ).not.toThrow();
  });

  it('does not navigate for an unknown notification type', () => {
    const handler = jest.fn();
    setNavigationHandler(handler);

    handleNotificationTapped(responseWith({ type: 'unknown' }));

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('handleNotificationReceived', () => {
  it('does not throw on a malformed notification', () => {
    expect(() =>
      handleNotificationReceived({} as unknown as Notifications.Notification),
    ).not.toThrow();
  });
});

describe('unregister', () => {
  it('posts the cached token to the unregister endpoint after registration', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(granted as never);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValueOnce({
      data: 'ExponentPushToken[del]',
    } as never);
    await registerToken('jwt-123');
    mockPost.mockClear();

    await unregister();

    expect(mockPost).toHaveBeenCalledWith(PUSH_UNREGISTER_ENDPOINT, {
      token: 'ExponentPushToken[del]',
    });
  });

  it('no-ops when there is no cached token', async () => {
    await unregister();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('does not throw when the backend unregister call fails', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce(granted as never);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValueOnce({
      data: 'ExponentPushToken[fail]',
    } as never);
    await registerToken('jwt-123');
    mockPost.mockRejectedValueOnce(new Error('network'));

    await expect(unregister()).resolves.toBeUndefined();
  });
});
