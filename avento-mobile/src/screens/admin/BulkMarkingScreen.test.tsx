/**
 * Component tests for the Admin BulkMarkingScreen (task 11.2).
 *
 * Covers the screen's contract — the top-priority fast attendance workflow:
 *  - loads group members and defaults ALL students to "Present" (Req 10.3)
 *  - tapping a student cycles their status (Req 10.8)
 *  - submitting builds the correct bulk payload and POSTs it, then shows a
 *    success confirmation with the record count (Req 10.4, 10.6)
 *  - on failure the marked data is retained for retry (Req 10.7)
 *  - while offline the submission is enqueued and a pending indicator is shown
 *    (Req 21.2)
 *
 * adminApi, react-navigation, NetInfo and the offline queue store are mocked so
 * the screen is exercised in isolation without network or a real navigator.
 *
 * Validates: Requirements 10.2, 10.3, 10.4, 10.6, 10.7, 10.9, 21.2
 */
import NetInfo from '@react-native-community/netinfo';

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { BulkAttendancePayload, Person } from '@/types/models';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: { groupId: 'g-1', groupName: 'Class 1A' } }),
}));

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getGroupMembers: jest.fn(),
    submitBulkAttendance: jest.fn(),
  },
}));

const mockEnqueue = jest.fn();
jest.mock('@/stores/offlineQueue', () => ({
  __esModule: true,
  useOfflineQueue: (selector: (s: { enqueue: jest.Mock }) => unknown) =>
    selector({ enqueue: mockEnqueue }),
}));

import { adminApi } from '@/api/admin';
import BulkMarkingScreen from './BulkMarkingScreen';

const mockGetMembers = adminApi.getGroupMembers as jest.Mock;
const mockSubmit = adminApi.submitBulkAttendance as jest.Mock;
const mockNetInfoFetch = NetInfo.fetch as jest.Mock;

function person(overrides: Partial<Person>): Person {
  return {
    id: 'p-1',
    name: 'Student One',
    is_active: true,
    ...overrides,
  };
}

const MEMBERS: Person[] = [
  person({ id: 'p-1', name: 'Aanya' }),
  person({ id: 'p-2', name: 'Vihaan' }),
  person({ id: 'p-3', name: 'Diya' }),
];

beforeEach(() => {
  jest.clearAllMocks();
  mockNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
});

describe('BulkMarkingScreen', () => {
  it('defaults all loaded students to Present', async () => {
    mockGetMembers.mockResolvedValue(MEMBERS);

    renderWithProviders(<BulkMarkingScreen />);

    await screen.findByText('Aanya');

    expect(screen.getByTestId('bulk-student-status-p-1')).toHaveTextContent('Present');
    expect(screen.getByTestId('bulk-student-status-p-2')).toHaveTextContent('Present');
    expect(screen.getByTestId('bulk-student-status-p-3')).toHaveTextContent('Present');
  });

  it('cycles a student status when tapped', async () => {
    mockGetMembers.mockResolvedValue(MEMBERS);

    renderWithProviders(<BulkMarkingScreen />);

    await screen.findByText('Aanya');

    fireEvent.press(screen.getByTestId('bulk-student-p-1'));
    expect(screen.getByTestId('bulk-student-status-p-1')).toHaveTextContent('Absent');

    fireEvent.press(screen.getByTestId('bulk-student-p-1'));
    expect(screen.getByTestId('bulk-student-status-p-1')).toHaveTextContent('Late');
  });

  it('submits the correct bulk payload and shows a success count', async () => {
    mockGetMembers.mockResolvedValue(MEMBERS);
    mockSubmit.mockResolvedValue({ message: 'ok', count: 3, records: [] });

    renderWithProviders(<BulkMarkingScreen />);

    await screen.findByText('Aanya');

    // Mark one student Absent before submitting.
    fireEvent.press(screen.getByTestId('bulk-student-p-2'));
    fireEvent.press(screen.getByTestId('bulk-marking-submit'));

    await screen.findByTestId('bulk-marking-success');

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    const payload = mockSubmit.mock.calls[0][0] as BulkAttendancePayload;
    expect(payload.group_id).toBe('g-1');
    expect(payload.records).toHaveLength(3);
    expect(payload.records.find((r) => r.person_id === 'p-2')?.presence_status).toBe(
      'Absent',
    );
    expect(payload.records.find((r) => r.person_id === 'p-1')?.presence_status).toBe(
      'Present',
    );

    expect(screen.getByTestId('bulk-marking-success-count')).toHaveTextContent(
      '3 records saved for Class 1A.',
    );
  });

  it('retains marked data when submission fails', async () => {
    mockGetMembers.mockResolvedValue(MEMBERS);
    mockSubmit.mockRejectedValue(new Error('server error'));

    renderWithProviders(<BulkMarkingScreen />);

    await screen.findByText('Aanya');

    // Toggle a student, then submit (which fails).
    fireEvent.press(screen.getByTestId('bulk-student-p-3'));
    expect(screen.getByTestId('bulk-student-status-p-3')).toHaveTextContent('Absent');

    fireEvent.press(screen.getByTestId('bulk-marking-submit'));

    // Error surfaces and the marked data is retained (still on the list screen).
    await screen.findByTestId('bulk-marking-submit-error');
    expect(screen.getByTestId('bulk-student-status-p-3')).toHaveTextContent('Absent');
    expect(screen.queryByTestId('bulk-marking-success')).toBeNull();
  });

  it('enqueues the submission when offline', async () => {
    mockGetMembers.mockResolvedValue(MEMBERS);
    mockNetInfoFetch.mockResolvedValue({ isConnected: false, isInternetReachable: false });

    renderWithProviders(<BulkMarkingScreen />);

    await screen.findByText('Aanya');

    fireEvent.press(screen.getByTestId('bulk-marking-submit'));

    await screen.findByTestId('bulk-marking-queued');

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const op = mockEnqueue.mock.calls[0][0];
    expect(op.method).toBe('POST');
    expect(op.url).toBe('/api/attendance/bulk');
    expect((op.body as BulkAttendancePayload).records).toHaveLength(3);
  });
});
