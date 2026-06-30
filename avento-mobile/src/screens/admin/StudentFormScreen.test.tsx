/**
 * Component tests for the Admin StudentFormScreen (task 12.1).
 *
 * Covers the screen's contract:
 *  - CREATE: submits the correct payload via adminApi.createPerson and returns
 *    to the list (Requirement 11.3)
 *  - blocks submit with a field error when the required name is empty
 *  - EDIT: prefills from the existing record and submits updates via
 *    adminApi.updatePerson (Requirement 11.5)
 *  - DETAIL: shows group + derived parent-account status (Requirement 11.4)
 *  - DEACTIVATE: calls adminApi.deactivatePerson and returns to the list
 *    (Requirement 11.6)
 *
 * adminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { Person } from '@/types/models';
import type { Paginated } from '@/api/portal';

const mockGoBack = jest.fn();
let mockRouteParams: { personId?: string } | undefined;

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getGroups: jest.fn(),
    getPersons: jest.fn(),
    createPerson: jest.fn(),
    updatePerson: jest.fn(),
    deactivatePerson: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import StudentFormScreen from './StudentFormScreen';

const mockGetGroups = adminApi.getGroups as jest.Mock;
const mockGetPersons = adminApi.getPersons as jest.Mock;
const mockCreatePerson = adminApi.createPerson as jest.Mock;
const mockUpdatePerson = adminApi.updatePerson as jest.Mock;
const mockDeactivatePerson = adminApi.deactivatePerson as jest.Mock;

const EXISTING: Person = {
  id: 'p-1',
  name: 'Alice Adams',
  roll_number: '12',
  admission_number: 'ADM-1',
  parent_mobile: '555-1',
  parent_email: 'parent@example.com',
  gender: 'Female',
  date_of_birth: '2015-05-01',
  guardian_name: 'Mr Adams',
  group_id: 'g-1',
  group_name: 'Class 1A',
  is_active: true,
};

function personsPage(persons: Person[]): Paginated<Person> {
  return {
    data: persons,
    pagination: { page: 1, limit: 200, total: persons.length, totalPages: 1 },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = undefined;
  mockGetGroups.mockResolvedValue([
    { id: 'g-1', name: 'Class 1A', member_count: 2, attendance_marked_today: false },
  ]);
  mockGetPersons.mockResolvedValue(personsPage([EXISTING]));
  mockCreatePerson.mockResolvedValue({ ...EXISTING, id: 'p-new' });
  mockUpdatePerson.mockResolvedValue(EXISTING);
  mockDeactivatePerson.mockResolvedValue({ ...EXISTING, is_active: false });
});

describe('StudentFormScreen — create mode', () => {
  it('blocks submit and shows a field error when the name is empty', async () => {
    renderWithProviders(<StudentFormScreen />);

    fireEvent.press(screen.getByTestId('student-submit'));

    expect(await screen.findByTestId('student-error-name')).toBeOnTheScreen();
    expect(mockCreatePerson).not.toHaveBeenCalled();
  });

  it('submits the correct payload via createPerson and returns to the list', async () => {
    renderWithProviders(<StudentFormScreen />);

    fireEvent.changeText(screen.getByTestId('student-name'), 'Charlie Clark');
    fireEvent.changeText(screen.getByTestId('student-roll-number'), '7');
    fireEvent.changeText(screen.getByTestId('student-parent-email'), 'c@example.com');

    fireEvent.press(screen.getByTestId('student-submit'));

    await waitFor(() => {
      expect(mockCreatePerson).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Charlie Clark',
          roll_number: '7',
          parent_email: 'c@example.com',
        }),
      );
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });
});

describe('StudentFormScreen — edit / detail mode', () => {
  beforeEach(() => {
    mockRouteParams = { personId: 'p-1' };
  });

  it('prefills the form and shows the detail header with parent status', async () => {
    renderWithProviders(<StudentFormScreen />);

    // Prefilled name input.
    expect(await screen.findByDisplayValue('Alice Adams')).toBeOnTheScreen();

    // Detail header: group + linked parent (parent_email present).
    expect(screen.getByTestId('student-detail-group')).toHaveTextContent('Class 1A');
    expect(screen.getByTestId('student-detail-parent-status')).toHaveTextContent(
      'Linked',
    );
    expect(screen.getByTestId('student-detail-active')).toHaveTextContent('Active');
  });

  it('submits updates via updatePerson and returns to the list', async () => {
    renderWithProviders(<StudentFormScreen />);

    await screen.findByDisplayValue('Alice Adams');
    fireEvent.changeText(screen.getByTestId('student-name'), 'Alice A. Adams');

    fireEvent.press(screen.getByTestId('student-submit'));

    await waitFor(() => {
      expect(mockUpdatePerson).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({ name: 'Alice A. Adams' }),
      );
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('calls deactivatePerson and returns to the list', async () => {
    renderWithProviders(<StudentFormScreen />);

    fireEvent.press(await screen.findByTestId('student-deactivate'));

    await waitFor(() => {
      expect(mockDeactivatePerson).toHaveBeenCalledWith('p-1');
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });
});
