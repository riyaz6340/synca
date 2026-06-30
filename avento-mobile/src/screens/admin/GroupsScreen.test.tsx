/**
 * Component tests for the Admin GroupsScreen (task 12.2).
 *
 * Covers the screen's contract:
 *  - fetches groups via adminApi.getGroups and renders name + member count
 *    (Requirement 12.1)
 *  - "Add Group" navigates to GroupForm with no params (Requirement 12.2)
 *  - tapping a group navigates to GroupForm with { groupId } (Requirement 12.4)
 *  - shows an error state (with retry) when the fetch fails
 *  - shows an empty state when there are no groups
 *
 * adminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 12.1, 12.2, 12.4
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
import GroupsScreen from './GroupsScreen';

const mockGetGroups = adminApi.getGroups as jest.Mock;

const GROUPS: Group[] = [
  {
    id: 'g-1',
    name: 'Class 1A',
    description: 'Morning batch',
    member_count: 30,
    attendance_marked_today: false,
  },
  { id: 'g-2', name: 'Class 2B', member_count: 1, attendance_marked_today: true },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GroupsScreen', () => {
  it('renders each group with its name and member count', async () => {
    mockGetGroups.mockResolvedValue(GROUPS);

    renderWithProviders(<GroupsScreen />);

    expect(await screen.findByText('Class 1A')).toBeOnTheScreen();
    expect(screen.getByText('Class 2B')).toBeOnTheScreen();
    expect(screen.getByTestId('group-member-count-g-1')).toHaveTextContent(
      '30 members',
    );
    expect(screen.getByTestId('group-member-count-g-2')).toHaveTextContent('1 member');
  });

  it('navigates to GroupForm with no params when Add Group is tapped', async () => {
    mockGetGroups.mockResolvedValue(GROUPS);

    renderWithProviders(<GroupsScreen />);
    await screen.findByText('Class 1A');

    fireEvent.press(screen.getByTestId('groups-add-button'));

    expect(mockNavigate).toHaveBeenCalledWith('GroupForm', undefined);
  });

  it('navigates to GroupForm with the group id on tap', async () => {
    mockGetGroups.mockResolvedValue(GROUPS);

    renderWithProviders(<GroupsScreen />);

    fireEvent.press(await screen.findByTestId('group-row-g-1'));

    expect(mockNavigate).toHaveBeenCalledWith('GroupForm', { groupId: 'g-1' });
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetGroups
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(GROUPS);

    renderWithProviders(<GroupsScreen />);

    expect(await screen.findByTestId('groups-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByText('Class 1A')).toBeOnTheScreen();
    expect(screen.queryByTestId('groups-error')).toBeNull();
  });

  it('shows an empty state when there are no groups', async () => {
    mockGetGroups.mockResolvedValue([]);

    renderWithProviders(<GroupsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('groups-empty')).toBeOnTheScreen();
    });
  });
});
