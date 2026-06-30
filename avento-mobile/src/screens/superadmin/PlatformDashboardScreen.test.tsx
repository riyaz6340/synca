/**
 * Component tests for the SuperAdmin PlatformDashboardScreen (task 14.1).
 *
 * Covers the screen's contract:
 *  - renders total organizations, users, and persons counts
 *  - renders today's platform-wide attendance total and per-status buckets
 *  - re-fetches on pull-to-refresh
 *  - shows an ErrorState (with retry) when the fetch fails, and recovers on retry
 *
 * `superAdminApi.getPlatformDashboard` is mocked so the screen is exercised in
 * isolation without network access.
 *
 * Validates: Requirements 18.1, 18.2, 18.3
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '../../__tests__/utils/renderWithProviders';
import type { PlatformDashboardResponse } from '@/api/superadmin';

jest.mock('@/api/superadmin', () => ({
  __esModule: true,
  superAdminApi: {
    getPlatformDashboard: jest.fn(),
  },
  default: { getPlatformDashboard: jest.fn() },
}));

import { superAdminApi } from '@/api/superadmin';
import PlatformDashboardScreen from './PlatformDashboardScreen';

const mockGetPlatformDashboard = superAdminApi.getPlatformDashboard as jest.Mock;

const DASHBOARD: PlatformDashboardResponse = {
  overview: {
    total_organizations: 12,
    total_persons: 3400,
    total_users: 88,
    total_attendance_records: 125_000,
    monthly_revenue: 4800,
  },
  plan_breakdown: [{ plan: 'pro', count: 5 }],
  industry_breakdown: [{ industry_module: 'education', count: 10 }],
  billing_breakdown: [{ billing_status: 'active', count: 11 }],
  today_attendance: [
    { presence_status: 'Present', count: 2100 },
    { presence_status: 'Absent', count: 250 },
    { presence_status: 'Late', count: 80 },
    { presence_status: 'On_Leave', count: 40 },
  ],
  recent_organizations: [],
  organizations_by_size: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PlatformDashboardScreen', () => {
  it('renders platform totals and today\'s attendance breakdown', async () => {
    mockGetPlatformDashboard.mockResolvedValue(DASHBOARD);

    renderWithProviders(<PlatformDashboardScreen />);

    // Platform-wide totals.
    expect(await screen.findByTestId('platform-total-organizations-count')).toHaveTextContent(
      '12',
    );
    expect(screen.getByTestId('platform-total-users-count')).toHaveTextContent('88');
    expect(screen.getByTestId('platform-total-persons-count')).toHaveTextContent('3400');

    // Today's attendance: total = 2100 + 250 + 80 + 40 = 2470.
    expect(screen.getByTestId('platform-today-total-count')).toHaveTextContent('2470');

    // Per-status buckets.
    expect(screen.getByTestId('platform-today-Present-count')).toHaveTextContent('2100');
    expect(screen.getByTestId('platform-today-Absent-count')).toHaveTextContent('250');
    expect(screen.getByTestId('platform-today-Late-count')).toHaveTextContent('80');
    expect(screen.getByTestId('platform-today-On_Leave-count')).toHaveTextContent('40');

    expect(mockGetPlatformDashboard).toHaveBeenCalledTimes(1);
  });

  it('renders an empty-today message when no attendance is marked', async () => {
    mockGetPlatformDashboard.mockResolvedValue({ ...DASHBOARD, today_attendance: [] });

    renderWithProviders(<PlatformDashboardScreen />);

    expect(await screen.findByTestId('platform-today-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('platform-today-total-count')).toHaveTextContent('0');
  });

  it('re-fetches the latest data on pull-to-refresh', async () => {
    mockGetPlatformDashboard.mockResolvedValue(DASHBOARD);

    renderWithProviders(<PlatformDashboardScreen />);

    await screen.findByTestId('platform-total-organizations-count');
    expect(mockGetPlatformDashboard).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('platform-dashboard-scroll'), 'refresh');

    await waitFor(() => {
      expect(mockGetPlatformDashboard).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an ErrorState with retry when the fetch fails and recovers on retry', async () => {
    mockGetPlatformDashboard
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(DASHBOARD);

    renderWithProviders(<PlatformDashboardScreen />);

    expect(await screen.findByTestId('platform-dashboard-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByTestId('platform-total-organizations-count')).toHaveTextContent(
      '12',
    );
    expect(screen.queryByTestId('platform-dashboard-error')).toBeNull();
  });
});
