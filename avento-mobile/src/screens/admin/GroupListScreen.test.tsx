/**
 * Component tests for the Admin GroupListScreen (task 11.2).
 *
 * Covers the screen's contract:
 *  - fetches groups via adminApi.getGroups
 *  - shows a clear marked/unmarked indicator per group (Requirement 10.1)
 *  - tapping a group navigates to BulkMarking with { groupId, groupName }
 *    (Requirement 10.2)
 *  - shows an error state (with retry) when the fetch fails
 *  - shows an empty state when there are no groups
 *
 * adminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 10.1, 10.2
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { Group } from '@/types/models';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getGroups: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import GroupListScreen from './GroupListScreen';

const mockGetGroups = adminApi.getGroups as jest.Mock;

const GROUPS: Group[] = [
  { id: 'g-1', name: 'Class 1A', member_count: 30, attendance_marked_today: false },
  { id: 'g-2', name: 'Class 2B', member_count: 1, attendance_marked_today: true },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GroupListScreen', () => {
  it('renders each group with a marked/unmarked indicator', async () => {
    mockGetGroups.mockResolvedValue(GROUPS);

    renderWithProviders(<GroupListScreen />);

    expect(await screen.findByText('Class 1A')).toBeOnTheScreen();
    expect(screen.getByText('Class 2B')).toBeOnTheScreen();

    // Unmarked group shows "Not marked"; marked group shows "Marked today".
    expect(screen.getByTestId('group-status-g-1')).toHaveTextContent('Not marked');
    expect(screen.getByTestId('group-status-g-2')).toHaveTextContent('Marked today');

    // Member counts: singular vs plural.
    expect(screen.getByText('30 students')).toBeOnTheScreen();
    expect(screen.getByText('1 student')).toBeOnTheScreen();
  });

  it('navigates to AttendanceMode with the group id and name on tap', async () => {
    mockGetGroups.mockResolvedValue(GROUPS);

    renderWithProviders(<GroupListScreen />);

    fireEvent.press(await screen.findByTestId('group-row-g-1'));

    expect(mockNavigate).toHaveBeenCalledWith('AttendanceMode', {
      groupId: 'g-1',
      groupName: 'Class 1A',
    });
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetGroups
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(GROUPS);

    renderWithProviders(<GroupListScreen />);

    expect(await screen.findByTestId('group-list-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByText('Class 1A')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-list-error')).toBeNull();
  });

  it('shows an empty state when there are no groups', async () => {
    mockGetGroups.mockResolvedValue([]);

    renderWithProviders(<GroupListScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('group-list-empty')).toBeOnTheScreen();
    });
  });
});
