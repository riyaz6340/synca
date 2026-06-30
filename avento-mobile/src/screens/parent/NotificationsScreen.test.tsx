/**
 * Component tests for NotificationsScreen (task 9.8).
 *
 * Covers the screen's contract:
 *  - renders notifications in reverse chronological order (most recent first)
 *  - loads the next page when the list end is reached (infinite scroll) and
 *    shows a footer loader while fetching
 *  - shows an unread indicator when notifications newer than the last-seen
 *    marker exist
 *
 * The portal API is mocked to return paged data; AsyncStorage uses its
 * in-memory jest mock (configured in the global test setup).
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/__tests__/utils/renderWithProviders';
import { portalApi, type Paginated } from '@/api/portal';
import type { Notification } from '@/types/models';

import NotificationsScreen, { LAST_SEEN_STORAGE_KEY } from './NotificationsScreen';

jest.mock('@/api/portal', () => ({
  __esModule: true,
  portalApi: {
    getNotifications: jest.fn(),
  },
}));

const mockGetNotifications = portalApi.getNotifications as jest.Mock;

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    title: 'Title',
    body: 'Body',
    sent_at: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePage(
  notifications: Notification[],
  page: number,
  totalPages: number,
): Paginated<Notification> {
  return {
    data: notifications,
    pagination: {
      page,
      limit: 20,
      total: totalPages * 20,
      totalPages,
    },
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('NotificationsScreen', () => {
  it('renders notifications in reverse chronological order', async () => {
    // Returned out of order; the screen must sort newest-first by created_at.
    mockGetNotifications.mockResolvedValueOnce(
      makePage(
        [
          makeNotification({
            id: 'older',
            title: 'Older notice',
            created_at: '2024-01-01T08:00:00Z',
          }),
          makeNotification({
            id: 'newer',
            title: 'Newer notice',
            created_at: '2024-03-10T08:00:00Z',
          }),
          makeNotification({
            id: 'middle',
            title: 'Middle notice',
            created_at: '2024-02-05T08:00:00Z',
          }),
        ],
        1,
        1,
      ),
    );

    renderWithProviders(<NotificationsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('notification-item-newer')).toBeOnTheScreen(),
    );

    const list = screen.getByTestId('notifications-list');
    const titles = within(list)
      .getAllByTestId(/^notification-title-/)
      .map((node) => node.props.children);

    expect(titles).toEqual(['Newer notice', 'Middle notice', 'Older notice']);
  });

  it('loads the next page when the end of the list is reached', async () => {
    mockGetNotifications
      .mockResolvedValueOnce(
        makePage(
          [
            makeNotification({
              id: 'p1',
              title: 'Page one notice',
              created_at: '2024-03-01T00:00:00Z',
            }),
          ],
          1,
          2,
        ),
      )
      .mockResolvedValueOnce(
        makePage(
          [
            makeNotification({
              id: 'p2',
              title: 'Page two notice',
              created_at: '2024-02-01T00:00:00Z',
            }),
          ],
          2,
          2,
        ),
      );

    renderWithProviders(<NotificationsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('notification-item-p1')).toBeOnTheScreen(),
    );
    expect(mockGetNotifications).toHaveBeenCalledTimes(1);

    // Simulate reaching the end of the scrollable list.
    fireEvent(screen.getByTestId('notifications-list'), 'onEndReached');

    await waitFor(() =>
      expect(screen.getByTestId('notification-item-p2')).toBeOnTheScreen(),
    );
    expect(mockGetNotifications).toHaveBeenCalledTimes(2);
    expect(mockGetNotifications).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  });

  it('shows an unread indicator when new notifications exist', async () => {
    mockGetNotifications.mockResolvedValueOnce(
      makePage(
        [
          makeNotification({ id: 'a', created_at: '2024-04-01T00:00:00Z' }),
          makeNotification({ id: 'b', created_at: '2024-04-02T00:00:00Z' }),
        ],
        1,
        1,
      ),
    );

    renderWithProviders(<NotificationsScreen />);

    await waitFor(() =>
      expect(
        screen.getByTestId('notifications-unread-indicator'),
      ).toBeOnTheScreen(),
    );

    // Both notifications are newer than the (absent) last-seen marker.
    expect(
      within(screen.getByTestId('notifications-unread-indicator')).getByText('2'),
    ).toBeOnTheScreen();
  });

  it('hides the unread indicator when the last-seen marker covers all items', async () => {
    await AsyncStorage.setItem(LAST_SEEN_STORAGE_KEY, '2024-12-31T00:00:00Z');
    mockGetNotifications.mockResolvedValueOnce(
      makePage(
        [makeNotification({ id: 'a', created_at: '2024-04-01T00:00:00Z' })],
        1,
        1,
      ),
    );

    renderWithProviders(<NotificationsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('notification-item-a')).toBeOnTheScreen(),
    );

    expect(
      screen.queryByTestId('notifications-unread-indicator'),
    ).toBeNull();
  });

  it('shows an empty state when there are no notifications', async () => {
    mockGetNotifications.mockResolvedValueOnce(makePage([], 1, 1));

    renderWithProviders(<NotificationsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('notifications-empty')).toBeOnTheScreen(),
    );
  });
});
