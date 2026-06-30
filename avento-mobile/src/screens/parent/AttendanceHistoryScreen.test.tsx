/**
 * Component tests for AttendanceHistoryScreen (task 9.2).
 *
 * Covers the screen's contract:
 *  - fetches attendance for the routed child and renders the records
 *  - renders a per-status summary with correct counts
 *  - changing the date range refetches with the new start_date / end_date
 *  - shows an empty state when there are no records for the period
 *
 * The portal API is mocked so the screen is exercised in isolation without
 * network access, and rendered through `renderWithProviders` so React Query
 * has a client.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */
import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { AttendanceRecord } from '@/types/models';
import type { ParentAttendanceStackParamList } from '@/types/navigation';

// --- Mocks ------------------------------------------------------------------

jest.mock('@/api/portal', () => ({
  __esModule: true,
  portalApi: {
    getAttendanceHistory: jest.fn(),
  },
}));

jest.mock('@/components/DateRangePicker', () =>
  require('@/__tests__/mocks/DateRangePicker'),
);

import { portalApi } from '@/api/portal';
import AttendanceHistoryScreen from './AttendanceHistoryScreen';

const mockGetAttendanceHistory =
  portalApi.getAttendanceHistory as jest.Mock;

const RECORDS: AttendanceRecord[] = [
  { id: 'a1', date: '2024-03-01', time: '08:55', presence_status: 'Present' },
  { id: 'a2', date: '2024-03-02', time: null, presence_status: 'Absent' },
  { id: 'a3', date: '2024-03-03', time: '09:20', presence_status: 'Late' },
  { id: 'a4', date: '2024-03-04', time: null, presence_status: 'On_Leave' },
  { id: 'a5', date: '2024-03-05', time: '08:50', presence_status: 'Present' },
];

type Props = NativeStackScreenProps<
  ParentAttendanceStackParamList,
  'AttendanceHistory'
>;

/** Build a minimal route/navigation prop set for the screen. */
function buildProps(
  params: { personId: string; personName: string } = {
    personId: 'person-1',
    personName: 'Ada Lovelace',
  }
): Props {
  return {
    route: { key: 'AttendanceHistory-1', name: 'AttendanceHistory', params },
    navigation: {} as Props['navigation'],
  } as Props;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAttendanceHistory.mockResolvedValue(RECORDS);
});

describe('AttendanceHistoryScreen', () => {
  it('fetches and renders the child attendance records', async () => {
    renderWithProviders(<AttendanceHistoryScreen {...buildProps()} />);

    // Heading shows the routed child's name.
    expect(screen.getByText('Ada Lovelace')).toBeOnTheScreen();

    await waitFor(() => {
      expect(mockGetAttendanceHistory).toHaveBeenCalledTimes(1);
    });
    // The fetch targets the routed personId.
    expect(mockGetAttendanceHistory.mock.calls[0][0]).toBe('person-1');

    // Each record row is rendered.
    expect(await screen.findByTestId('attendance-row-2024-03-01')).toBeOnTheScreen();
    expect(screen.getByTestId('attendance-row-2024-03-04')).toBeOnTheScreen();
  });

  it('renders a summary with the correct per-status counts', async () => {
    renderWithProviders(<AttendanceHistoryScreen {...buildProps()} />);

    await screen.findByTestId('attendance-summary');

    // 2 Present, 1 Absent, 1 Late, 1 On_Leave in RECORDS.
    expect(screen.getByTestId('summary-present')).toHaveTextContent('2');
    expect(screen.getByTestId('summary-absent')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-late')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-on-leave')).toHaveTextContent('1');
  });

  it('refetches with new params when the date range changes', async () => {
    renderWithProviders(<AttendanceHistoryScreen {...buildProps()} />);

    await waitFor(() => {
      expect(mockGetAttendanceHistory).toHaveBeenCalledTimes(1);
    });

    fireEvent.changeText(
      screen.getByTestId('date-range-picker-start'),
      '2024-02-01'
    );
    fireEvent.changeText(
      screen.getByTestId('date-range-picker-end'),
      '2024-02-28'
    );

    await waitFor(() => {
      expect(mockGetAttendanceHistory).toHaveBeenLastCalledWith('person-1', {
        start_date: '2024-02-01',
        end_date: '2024-02-28',
      });
    });
  });

  it('shows an empty state when there are no records for the period', async () => {
    mockGetAttendanceHistory.mockResolvedValue([]);

    renderWithProviders(<AttendanceHistoryScreen {...buildProps()} />);

    await waitFor(() => {
      expect(mockGetAttendanceHistory).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByTestId('empty-state')).toBeOnTheScreen();
    expect(screen.getByText('No records found')).toBeOnTheScreen();
  });
});
