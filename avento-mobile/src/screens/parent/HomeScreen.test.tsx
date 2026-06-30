/**
 * Component tests for the Parent HomeScreen (task 9.1).
 *
 * Covers the screen's contract:
 *  - renders each child's name with a color-coded status badge
 *  - shows "Not Marked" for children with no attendance record today
 *  - shows an ErrorState (with retry) when the fetch fails and there is no
 *    cached data, and recovers when retried
 *  - shows the OfflineBanner above cached data when the device is offline
 *  - re-fetches on pull-to-refresh
 *  - shows an empty state when the parent has no linked children
 *
 * `portalApi.getPersons` and NetInfo are mocked so the screen is exercised in
 * isolation without network access.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */
import NetInfo from '@react-native-community/netinfo';

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '../../__tests__/utils/renderWithProviders';
import type { PersonWithStatus } from '@/types/models';

jest.mock('@/api/portal', () => ({
  __esModule: true,
  portalApi: {
    getPersons: jest.fn(),
  },
  default: { getPersons: jest.fn() },
}));

import { portalApi } from '@/api/portal';
import HomeScreen from './HomeScreen';

const mockGetPersons = portalApi.getPersons as jest.Mock;
const mockNetInfoFetch = NetInfo.fetch as jest.Mock;

const CHILDREN: PersonWithStatus[] = [
  {
    id: 'p-1',
    name: 'Aanya Sharma',
    current_status: { presence_status: 'Present', time: '08:45' },
  },
  {
    id: 'p-2',
    name: 'Vihaan Sharma',
    current_status: { presence_status: 'Absent', time: '09:00' },
  },
  // No attendance record today → should render "Not Marked".
  { id: 'p-3', name: 'Diya Sharma', current_status: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  // Default: device is online.
  mockNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
});

describe('HomeScreen', () => {
  it('renders each child with a color-coded status, showing "Not Marked" for null status', async () => {
    mockGetPersons.mockResolvedValue(CHILDREN);

    renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Aanya Sharma')).toBeOnTheScreen();
    expect(screen.getByText('Vihaan Sharma')).toBeOnTheScreen();
    expect(screen.getByText('Diya Sharma')).toBeOnTheScreen();

    // Status badges map to their labels; the null-status child reads "Not Marked".
    expect(screen.getByTestId('child-status-p-1')).toHaveTextContent('Present');
    expect(screen.getByTestId('child-status-p-2')).toHaveTextContent('Absent');
    expect(screen.getByTestId('child-status-p-3')).toHaveTextContent('Not Marked');
  });

  it('shows an ErrorState with retry when the fetch fails and recovers on retry', async () => {
    mockGetPersons
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(CHILDREN);

    renderWithProviders(<HomeScreen />);

    const errorState = await screen.findByTestId('home-error');
    expect(errorState).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    // After a successful retry the children list is shown.
    expect(await screen.findByText('Aanya Sharma')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-error')).toBeNull();
  });

  it('shows the offline banner above cached data when the device is offline', async () => {
    mockGetPersons.mockResolvedValue(CHILDREN);
    mockNetInfoFetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });

    renderWithProviders(<HomeScreen />);

    // Cached data still renders...
    expect(await screen.findByText('Aanya Sharma')).toBeOnTheScreen();
    // ...with the offline banner shown above it.
    await waitFor(() => {
      expect(screen.getByTestId('offline-banner')).toBeOnTheScreen();
    });
  });

  it('re-fetches the latest data on pull-to-refresh', async () => {
    mockGetPersons.mockResolvedValue(CHILDREN);

    renderWithProviders(<HomeScreen />);

    await screen.findByText('Aanya Sharma');
    expect(mockGetPersons).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('home-children-list'), 'refresh');

    await waitFor(() => {
      expect(mockGetPersons).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an empty state when there are no linked children', async () => {
    mockGetPersons.mockResolvedValue([]);

    renderWithProviders(<HomeScreen />);

    expect(await screen.findByTestId('home-empty')).toBeOnTheScreen();
  });
});
