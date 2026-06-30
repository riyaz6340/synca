/**
 * Component tests for the Admin GroupFormScreen (task 12.2).
 *
 * Covers the screen's two modes:
 *  - **Create**: blocks submit with a field error when the name is empty, and
 *    on a valid name POSTs via adminApi.createGroup then navigates back
 *    (Requirements 12.2, 12.3).
 *  - **Detail + edit**: loads the group detail + members and renders the member
 *    list (Requirement 12.4); adding a member calls adminApi.addGroupMembers and
 *    removing a member calls adminApi.removeGroupMember (Requirement 12.5).
 *
 * adminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 12.2, 12.3, 12.4, 12.5
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { Person } from '@/types/models';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockRouteParams: { groupId?: string } | undefined;

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getGroup: jest.fn(),
    getPersons: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    addGroupMembers: jest.fn(),
    removeGroupMember: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import GroupFormScreen from './GroupFormScreen';

const mockGetGroup = adminApi.getGroup as jest.Mock;
const mockGetPersons = adminApi.getPersons as jest.Mock;
const mockCreateGroup = adminApi.createGroup as jest.Mock;
const mockAddMembers = adminApi.addGroupMembers as jest.Mock;
const mockRemoveMember = adminApi.removeGroupMember as jest.Mock;

function person(overrides: Partial<Person>): Person {
  return { id: 'p-1', name: 'Student', is_active: true, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = undefined;
});

describe('GroupFormScreen — create mode', () => {
  it('blocks submit and shows an error when the name is empty', async () => {
    renderWithProviders(<GroupFormScreen />);

    fireEvent.press(screen.getByTestId('group-submit'));

    expect(await screen.findByTestId('group-name-error')).toBeOnTheScreen();
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });

  it('creates a group and navigates back on success', async () => {
    mockCreateGroup.mockResolvedValue({
      id: 'g-new',
      name: 'Class 3C',
      member_count: 0,
      attendance_marked_today: false,
    });

    renderWithProviders(<GroupFormScreen />);

    fireEvent.changeText(screen.getByTestId('group-name-input'), 'Class 3C');
    fireEvent.changeText(
      screen.getByTestId('group-description-input'),
      'Evening batch',
    );
    fireEvent.press(screen.getByTestId('group-submit'));

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({
        name: 'Class 3C',
        description: 'Evening batch',
      });
    });
    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe('GroupFormScreen — detail + edit mode', () => {
  const MEMBERS: Person[] = [person({ id: 'p-1', name: 'Aanya' })];
  const ALL_PERSONS: Person[] = [
    person({ id: 'p-1', name: 'Aanya' }),
    person({ id: 'p-2', name: 'Vihaan' }),
    person({ id: 'p-3', name: 'Diya' }),
  ];

  beforeEach(() => {
    mockRouteParams = { groupId: 'g-1' };
    mockGetGroup.mockResolvedValue({
      id: 'g-1',
      name: 'Class 1A',
      description: 'Morning batch',
      members: MEMBERS,
    });
    mockGetPersons.mockResolvedValue({
      data: ALL_PERSONS,
      pagination: { page: 1, limit: 100, total: 3, totalPages: 1 },
    });
  });

  it('loads the group detail and renders the member list', async () => {
    renderWithProviders(<GroupFormScreen />);

    expect(await screen.findByTestId('group-member-p-1')).toBeOnTheScreen();
    expect(screen.getByText('Aanya')).toBeOnTheScreen();
    // Name is prefilled from the loaded detail.
    expect(screen.getByTestId('group-name-input').props.value).toBe('Class 1A');
  });

  it('adds a member via the dropdown', async () => {
    mockAddMembers.mockResolvedValue({ message: 'Members added', added_count: 1 });

    renderWithProviders(<GroupFormScreen />);
    await screen.findByTestId('group-member-p-1');

    // Open the dropdown and pick a person who is not already a member.
    fireEvent.press(screen.getByTestId('group-add-member-dropdown-trigger'));
    fireEvent.press(await screen.findByText('Vihaan'));

    fireEvent.press(screen.getByTestId('group-add-member-button'));

    await waitFor(() => {
      expect(mockAddMembers).toHaveBeenCalledWith('g-1', ['p-2']);
    });
  });

  it('removes a member', async () => {
    mockRemoveMember.mockResolvedValue(undefined);

    renderWithProviders(<GroupFormScreen />);
    await screen.findByTestId('group-member-p-1');

    fireEvent.press(screen.getByTestId('group-remove-member-p-1'));

    await waitFor(() => {
      expect(mockRemoveMember).toHaveBeenCalledWith('g-1', 'p-1');
    });
  });
});
