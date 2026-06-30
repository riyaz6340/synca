/**
 * Component tests for the Admin LeaveManagementScreen (task 12.3).
 *
 * Covers the screen's contract:
 *  - fetches leave requests via adminApi.getLeaveRequests
 *  - groups them by status with Pending first (Req 13.1)
 *  - shows a badge count of pending requests (Req 13.5)
 *  - Approve calls adminApi.approveLeave and refreshes the list (Req 13.3)
 *  - Reject requires a non-empty remark and calls adminApi.rejectLeave with the
 *    remark (Req 13.4)
 *  - tapping a request opens a detail view with child name, dates, reason and
 *    submission date (Req 13.2)
 *
 * adminApi is mocked so the screen is exercised in isolation without network.
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5
 */

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/__tests__/utils/renderWithProviders';
import type { LeaveRequest } from '@/types/models';

// --- Mocks ------------------------------------------------------------------

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getLeaveRequests: jest.fn(),
    approveLeave: jest.fn(),
    rejectLeave: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import LeaveManagementScreen from './LeaveManagementScreen';

const mockGet = adminApi.getLeaveRequests as jest.Mock;
const mockApprove = adminApi.approveLeave as jest.Mock;
const mockReject = adminApi.rejectLeave as jest.Mock;

function leave(overrides: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: 'lr-1',
    person_id: 'p-1',
    person_name: 'Alice',
    start_date: '2024-01-10',
    end_date: '2024-01-12',
    reason: 'Family trip',
    status: 'Pending',
    created_at: '2024-01-05T09:30:00.000Z',
    ...overrides,
  };
}

function paginated(requests: LeaveRequest[]) {
  return {
    data: requests,
    pagination: { page: 1, limit: 100, total: requests.length, totalPages: 1 },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LeaveManagementScreen', () => {
  it('groups leave requests by status with Pending first', async () => {
    mockGet.mockResolvedValue(
      paginated([
        leave({ id: 'a', status: 'Rejected', person_name: 'Rej Child' }),
        leave({ id: 'b', status: 'Pending', person_name: 'Pend Child' }),
        leave({ id: 'c', status: 'Approved', person_name: 'App Child' }),
        leave({ id: 'd', status: 'Pending', person_name: 'Pend Child 2' }),
      ])
    );

    renderWithProviders(<LeaveManagementScreen />);

    const pendingHeading = await screen.findByTestId('leave-group-Pending');
    expect(pendingHeading).toHaveTextContent('Pending (2)');
    expect(screen.getByTestId('leave-group-Approved')).toHaveTextContent('Approved (1)');
    expect(screen.getByTestId('leave-group-Rejected')).toHaveTextContent('Rejected (1)');

    const ordered = screen.getAllByTestId(/^leave-group-/);
    expect(ordered.map((n) => n.props.testID)).toEqual([
      'leave-group-Pending',
      'leave-group-Approved',
      'leave-group-Rejected',
    ]);
  });

  it('shows a badge count of pending requests', async () => {
    mockGet.mockResolvedValue(
      paginated([
        leave({ id: 'a', status: 'Pending' }),
        leave({ id: 'b', status: 'Pending' }),
        leave({ id: 'c', status: 'Approved' }),
      ])
    );

    renderWithProviders(<LeaveManagementScreen />);

    const badge = await screen.findByTestId('pending-badge');
    expect(badge).toHaveTextContent('2 pending');
  });

  it('approves a pending request via the API and refreshes the list', async () => {
    mockGet
      .mockResolvedValueOnce(paginated([leave({ id: 'a', status: 'Pending' })]))
      .mockResolvedValue(paginated([leave({ id: 'a', status: 'Approved' })]));
    mockApprove.mockResolvedValue(leave({ id: 'a', status: 'Approved' }));

    renderWithProviders(<LeaveManagementScreen />);

    fireEvent.press(await screen.findByTestId('leave-card-a-approve'));

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith('a');
    });
    // List is refetched after the mutation succeeds.
    await waitFor(() => {
      expect(mockGet.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('requires a remark before rejecting and submits the remark to the API', async () => {
    mockGet.mockResolvedValue(paginated([leave({ id: 'a', status: 'Pending' })]));
    mockReject.mockResolvedValue(leave({ id: 'a', status: 'Rejected', remarks: 'Too late' }));

    renderWithProviders(<LeaveManagementScreen />);

    // Open the reject remarks modal.
    fireEvent.press(await screen.findByTestId('leave-card-a-reject'));
    await screen.findByTestId('reject-modal');

    // Confirm with no remark → validation error, no API call.
    fireEvent.press(screen.getByTestId('reject-confirm'));
    expect(await screen.findByTestId('reject-error')).toBeOnTheScreen();
    expect(mockReject).not.toHaveBeenCalled();

    // Provide a remark and confirm → API called with the remark.
    fireEvent.changeText(screen.getByTestId('reject-remarks-input'), 'Too late');
    fireEvent.press(screen.getByTestId('reject-confirm'));

    await waitFor(() => {
      expect(mockReject).toHaveBeenCalledWith('a', 'Too late');
    });
  });

  it('opens a detail view with child name, dates, reason and submission date', async () => {
    mockGet.mockResolvedValue(
      paginated([
        leave({
          id: 'a',
          status: 'Pending',
          person_name: 'Bob',
          reason: 'Doctor visit',
          created_at: '2024-01-05T09:30:00.000Z',
        }),
      ])
    );

    renderWithProviders(<LeaveManagementScreen />);

    fireEvent.press(await screen.findByTestId('leave-card-a'));

    const modal = await screen.findByTestId('leave-detail-modal');
    expect(modal).toBeOnTheScreen();
    const inModal = within(modal);
    expect(inModal.getByText('Bob')).toBeOnTheScreen();
    expect(inModal.getByText('2024-01-10 → 2024-01-12')).toBeOnTheScreen();
    expect(inModal.getByText('Doctor visit')).toBeOnTheScreen();
    expect(inModal.getByTestId('leave-detail-submitted')).toBeOnTheScreen();
  });

  it('shows an empty state when there are no leave requests', async () => {
    mockGet.mockResolvedValue(paginated([]));

    renderWithProviders(<LeaveManagementScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('leave-mgmt-empty')).toBeOnTheScreen();
    });
  });
});
