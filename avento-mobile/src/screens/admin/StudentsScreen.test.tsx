/**
 * Component tests for the Admin StudentsScreen (task 12.1).
 *
 * Covers the screen's contract:
 *  - fetches and renders the paginated persons list (Requirement 11.1)
 *  - typing in the search box re-fetches with the `search` param
 *    (Requirement 11.1)
 *  - tapping a student navigates to StudentForm with { personId }
 *    (Requirement 11.4)
 *  - "Add Student" navigates to StudentForm in create mode (Requirement 11.2)
 *  - shows an error state (with retry) when the fetch fails
 *  - shows an empty state when no students match
 *
 * adminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 11.1, 11.2, 11.4
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { Person } from '@/types/models';
import type { Paginated } from '@/api/portal';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getPersons: jest.fn(),
    getGroups: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import StudentsScreen from './StudentsScreen';

const mockGetPersons = adminApi.getPersons as jest.Mock;
const mockGetGroups = adminApi.getGroups as jest.Mock;

const PERSONS: Person[] = [
  {
    id: 'p-1',
    name: 'Alice Adams',
    roll_number: '1',
    group_name: 'Class 1A',
    is_active: true,
  },
  {
    id: 'p-2',
    name: 'Bob Brown',
    roll_number: '2',
    group_name: 'Class 1A',
    is_active: false,
  },
];

function page(persons: Person[], totalPages = 1): Paginated<Person> {
  return {
    data: persons,
    pagination: { page: 1, limit: 20, total: persons.length, totalPages },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGroups.mockResolvedValue([
    { id: 'g-1', name: 'Class 1A', member_count: 2, attendance_marked_today: false },
  ]);
});

describe('StudentsScreen', () => {
  it('fetches and renders the persons list', async () => {
    mockGetPersons.mockResolvedValue(page(PERSONS));

    renderWithProviders(<StudentsScreen />);

    expect(await screen.findByText('Alice Adams')).toBeOnTheScreen();
    expect(screen.getByText('Bob Brown')).toBeOnTheScreen();

    // Inactive students get an "Inactive" marker.
    expect(screen.getByTestId('student-inactive-p-2')).toBeOnTheScreen();
    expect(screen.queryByTestId('student-inactive-p-1')).toBeNull();
  });

  it('re-fetches with the search param when the user types', async () => {
    mockGetPersons.mockResolvedValue(page(PERSONS));

    renderWithProviders(<StudentsScreen />);
    await screen.findByText('Alice Adams');

    fireEvent.changeText(screen.getByTestId('students-search'), 'Bob');

    await waitFor(() => {
      expect(mockGetPersons).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Bob', page: 1 }),
      );
    });
  });

  it('navigates to StudentForm with the personId on row tap', async () => {
    mockGetPersons.mockResolvedValue(page(PERSONS));

    renderWithProviders(<StudentsScreen />);

    fireEvent.press(await screen.findByTestId('student-row-p-1'));

    expect(mockNavigate).toHaveBeenCalledWith('StudentForm', { personId: 'p-1' });
  });

  it('navigates to StudentForm in create mode from "Add Student"', async () => {
    mockGetPersons.mockResolvedValue(page(PERSONS));

    renderWithProviders(<StudentsScreen />);
    await screen.findByText('Alice Adams');

    fireEvent.press(screen.getByTestId('students-add'));

    expect(mockNavigate).toHaveBeenCalledWith('StudentForm');
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetPersons
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(page(PERSONS));

    renderWithProviders(<StudentsScreen />);

    expect(await screen.findByTestId('students-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByText('Alice Adams')).toBeOnTheScreen();
    expect(screen.queryByTestId('students-error')).toBeNull();
  });

  it('shows an empty state when no students match', async () => {
    mockGetPersons.mockResolvedValue(page([]));

    renderWithProviders(<StudentsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('students-empty')).toBeOnTheScreen();
    });
  });
});
