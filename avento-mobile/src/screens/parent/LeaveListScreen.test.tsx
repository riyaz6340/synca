/**
 * Component tests for LeaveListScreen (task 9.6).
 *
 * Covers the screen's contract:
 *  - fetches leave requests via portalApi.getLeaveRequests
 *  - groups them by status in the order Pending → Approved → Rejected
 *  - renders each request's child name, date range, reason and remarks
 *  - shows an empty state when there are no requests
 *
 * portalApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 6.1, 6.5
 */

import {
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { LeaveRequest } from '@/types/models';

// --- Mocks ------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/api/portal', () => ({
  __esModule: true,
  portalApi: {
    getLeaveRequests: jest.fn(),
  },
}));

import { portalApi } from '@/api/portal';
import LeaveListScreen from './LeaveListScreen';

const mockGetLeaveRequests = portalApi.getLeaveRequests as jest.Mock;

function leave(overrides: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: 'lr-1',
    person_id: 'p-1',
    person_name: 'Alice',
    start_date: '2024-01-10',
    end_date: '2024-01-12',
    reason: 'Family trip',
    status: 'Pending',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LeaveListScreen', () => {
  it('groups leave requests by status with Pending first', async () => {
    const requests: LeaveRequest[] = [
      leave({ id: 'a', status: 'Rejected', person_name: 'Rej Child' }),
      leave({ id: 'b', status: 'Pending', person_name: 'Pend Child' }),
      leave({ id: 'c', status: 'Approved', person_name: 'App Child' }),
      leave({ id: 'd', status: 'Pending', person_name: 'Pend Child 2' }),
    ];
    mockGetLeaveRequests.mockResolvedValue({
      data: requests,
      pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
    });

    renderWithProviders(<LeaveListScreen />);

    // Pending group renders with a count of 2.
    const pendingHeading = await screen.findByTestId('leave-group-Pending');
    expect(pendingHeading).toHaveTextContent('Pending (2)');
    expect(screen.getByTestId('leave-group-Approved')).toHaveTextContent(
      'Approved (1)'
    );
    expect(screen.getByTestId('leave-group-Rejected')).toHaveTextContent(
      'Rejected (1)'
    );

    // Pending group heading appears before Approved and Rejected in the tree.
    const ordered = screen.getAllByTestId(/^leave-group-/);
    expect(ordered.map((n) => n.props.testID)).toEqual([
      'leave-group-Pending',
      'leave-group-Approved',
      'leave-group-Rejected',
    ]);
  });

  it('renders request details including reason and admin remarks', async () => {
    mockGetLeaveRequests.mockResolvedValue({
      data: [
        leave({
          id: 'x',
          status: 'Rejected',
          person_name: 'Bob',
          reason: 'Doctor visit',
          remarks: 'Insufficient notice',
        }),
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    renderWithProviders(<LeaveListScreen />);

    expect(await screen.findByText('Bob')).toBeOnTheScreen();
    expect(screen.getByText('Doctor visit')).toBeOnTheScreen();
    expect(screen.getByText('2024-01-10 → 2024-01-12')).toBeOnTheScreen();
    expect(
      screen.getByText('Admin remarks: Insufficient notice')
    ).toBeOnTheScreen();
  });

  it('shows an empty state when there are no leave requests', async () => {
    mockGetLeaveRequests.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    renderWithProviders(<LeaveListScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeOnTheScreen();
    });
  });
});
