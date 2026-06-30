/**
 * Component tests for the Admin DashboardScreen (task 11.1).
 *
 * Covers the screen's contract:
 *  - renders the total students count
 *  - renders Present/Absent/Late/On_Leave counts and percentages
 *  - renders the pending leave requests count
 *  - renders the count of groups not yet marked today
 *  - re-fetches on pull-to-refresh
 *  - shows an ErrorState (with retry) when the fetch fails, and recovers on retry
 *
 * `adminApi.getDashboard` is mocked so the screen is exercised in isolation
 * without network access.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '../../__tests__/utils/renderWithProviders';
import type { AdminDashboardSummary } from '@/api/admin';

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getDashboard: jest.fn(),
    getLeaveRequests: jest.fn(),
    getGroups: jest.fn(),
  },
  default: { getDashboard: jest.fn(), getLeaveRequests: jest.fn(), getGroups: jest.fn() },
}));

jest.mock('@/api/client', () => ({
  __esModule: true,
  apiClient: {
    get: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import DashboardScreen from './DashboardScreen';

const mockGetDashboard = adminApi.getDashboard as jest.Mock;

const SUMMARY: AdminDashboardSummary = {
  date: '2024-01-15',
  total_students: 120,
  present: 90,
  absent: 18,
  late: 7,
  on_leave: 5,
  present_percentage: 75,
  absent_percentage: 15,
  late_percentage: 6,
  on_leave_percentage: 4,
  pending_leave_requests: 3,
  groups_not_marked: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DashboardScreen', () => {
  it('renders total students, per-status counts and percentages, pending leave, and groups not marked', async () => {
    mockGetDashboard.mockResolvedValue(SUMMARY);

    renderWithProviders(<DashboardScreen />);

    // Total students.
    expect(await screen.findByTestId('dashboard-total-students-count')).toHaveTextContent(
      '120',
    );

    // Per-status counts.
    expect(screen.getByTestId('dashboard-present-count')).toHaveTextContent('90');
    expect(screen.getByTestId('dashboard-absent-count')).toHaveTextContent('18');
    expect(screen.getByTestId('dashboard-late-count')).toHaveTextContent('7');
    expect(screen.getByTestId('dashboard-on-leave-count')).toHaveTextContent('5');

    // Per-status percentages.
    expect(screen.getByTestId('dashboard-present-percentage')).toHaveTextContent('75%');
    expect(screen.getByTestId('dashboard-absent-percentage')).toHaveTextContent('15%');
    expect(screen.getByTestId('dashboard-late-percentage')).toHaveTextContent('6%');
    expect(screen.getByTestId('dashboard-on-leave-percentage')).toHaveTextContent('4%');

    // Pending leave requests + groups not marked.
    expect(screen.getByTestId('dashboard-pending-leave-count')).toHaveTextContent('3');
    expect(screen.getByTestId('dashboard-groups-not-marked-count')).toHaveTextContent('2');

    // Queried for a YYYY-MM-DD date.
    expect(mockGetDashboard).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('re-fetches the latest data on pull-to-refresh', async () => {
    mockGetDashboard.mockResolvedValue(SUMMARY);

    renderWithProviders(<DashboardScreen />);

    await screen.findByTestId('dashboard-total-students-count');
    expect(mockGetDashboard).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('dashboard-scroll'), 'refresh');

    await waitFor(() => {
      expect(mockGetDashboard).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an ErrorState with retry when the fetch fails and recovers on retry', async () => {
    mockGetDashboard
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(SUMMARY);

    renderWithProviders(<DashboardScreen />);

    expect(await screen.findByTestId('dashboard-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    // After a successful retry the dashboard data is shown.
    expect(await screen.findByTestId('dashboard-total-students-count')).toHaveTextContent(
      '120',
    );
    expect(screen.queryByTestId('dashboard-error')).toBeNull();
  });
});
