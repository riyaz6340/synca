/**
 * Component tests for LeaveFormScreen (task 9.6).
 *
 * Covers the screen's contract:
 *  - blocks submission and shows field-level errors when the form is invalid
 *    (empty required fields) and makes NO API call (Requirements 6.2, 6.4)
 *  - blocks submission and shows a date-range error when start_date > end_date
 *  - submits a valid request via portalApi.submitLeaveRequest and shows a
 *    success confirmation (Requirement 6.3)
 *
 * portalApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5
 */

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { PersonWithStatus } from '@/types/models';

// --- Mocks ------------------------------------------------------------------

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: undefined }),
}));

jest.mock('@/api/portal', () => ({
  __esModule: true,
  portalApi: {
    getPersons: jest.fn(),
    submitLeaveRequest: jest.fn(),
  },
}));

import { portalApi } from '@/api/portal';
import LeaveFormScreen from './LeaveFormScreen';

const mockGetPersons = portalApi.getPersons as jest.Mock;
const mockSubmit = portalApi.submitLeaveRequest as jest.Mock;

const PERSONS: PersonWithStatus[] = [
  { id: 'p-1', name: 'Alice', current_status: null },
  { id: 'p-2', name: 'Bob', current_status: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPersons.mockResolvedValue(PERSONS);
  mockSubmit.mockResolvedValue({
    id: 'lr-new',
    person_id: 'p-1',
    start_date: '2024-02-01',
    end_date: '2024-02-03',
    reason: 'Trip',
    status: 'Pending',
  });
});

/** Open the child dropdown and select the named child. */
async function selectChild(name: string): Promise<void> {
  fireEvent.press(screen.getByTestId('leave-person-dropdown-trigger'));
  fireEvent.press(await screen.findByText(name));
}

describe('LeaveFormScreen', () => {
  it('blocks submit and shows field errors when required fields are empty', async () => {
    renderWithProviders(<LeaveFormScreen />);
    await waitFor(() => expect(mockGetPersons).toHaveBeenCalled());

    fireEvent.press(screen.getByTestId('leave-submit'));

    // Field-level errors appear for every required field.
    expect(await screen.findByTestId('leave-error-person_id')).toBeOnTheScreen();
    expect(screen.getByTestId('leave-error-start_date')).toBeOnTheScreen();
    expect(screen.getByTestId('leave-error-end_date')).toBeOnTheScreen();
    expect(screen.getByTestId('leave-error-reason')).toBeOnTheScreen();

    // No API call is made for an invalid form.
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('blocks submit and shows an error when start_date is after end_date', async () => {
    renderWithProviders(<LeaveFormScreen />);
    await waitFor(() => expect(mockGetPersons).toHaveBeenCalled());

    await selectChild('Alice');
    fireEvent.changeText(screen.getByTestId('leave-date-range-start'), '2024-02-10');
    fireEvent.changeText(screen.getByTestId('leave-date-range-end'), '2024-02-01');
    fireEvent.changeText(screen.getByTestId('leave-reason'), 'Trip');

    fireEvent.press(screen.getByTestId('leave-submit'));

    expect(await screen.findByTestId('leave-error-end_date')).toHaveTextContent(
      'Start date must be on or before end date.'
    );
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid request and shows a success confirmation', async () => {
    renderWithProviders(<LeaveFormScreen />);
    await waitFor(() => expect(mockGetPersons).toHaveBeenCalled());

    await selectChild('Alice');
    fireEvent.changeText(screen.getByTestId('leave-date-range-start'), '2024-02-01');
    fireEvent.changeText(screen.getByTestId('leave-date-range-end'), '2024-02-03');
    fireEvent.changeText(screen.getByTestId('leave-reason'), 'Trip');
    fireEvent.changeText(screen.getByTestId('leave-type'), 'Vacation');

    fireEvent.press(screen.getByTestId('leave-submit'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        person_id: 'p-1',
        start_date: '2024-02-01',
        end_date: '2024-02-03',
        reason: 'Trip',
        leave_type: 'Vacation',
      });
    });

    expect(await screen.findByTestId('leave-form-success')).toBeOnTheScreen();
  });
});
