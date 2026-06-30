/**
 * Component tests for the Admin HolidayFormScreen (task 12.6).
 *
 * Covers the screen's contract:
 *  - submits a valid holiday with the correct payload via
 *    adminApi.createHoliday and invalidates the holidays list query
 *    (Requirements 16.2, 16.3)
 *  - navigates back on success
 *  - blocks submission with field-level errors when required fields (date,
 *    name) are empty, and makes NO create call
 *  - blocks submission when the date is malformed
 *
 * adminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 16.2, 16.3
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import { createTestQueryClient } from '@/__tests__/utils/renderWithProviders';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    createHoliday: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import HolidayFormScreen from './HolidayFormScreen';
import { ADMIN_HOLIDAYS_QUERY_KEY } from './HolidaysScreen';

const mockCreate = adminApi.createHoliday as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({
    id: 'h-new',
    date: '2024-08-15',
    name: 'Independence Day',
  });
});

describe('HolidayFormScreen', () => {
  it('blocks submit and shows field errors when required fields are empty', async () => {
    renderWithProviders(<HolidayFormScreen />);

    fireEvent.press(screen.getByTestId('holiday-submit'));

    expect(await screen.findByTestId('holiday-error-date')).toBeOnTheScreen();
    expect(screen.getByTestId('holiday-error-name')).toBeOnTheScreen();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('blocks submit when the date is malformed', async () => {
    renderWithProviders(<HolidayFormScreen />);

    fireEvent.changeText(screen.getByTestId('holiday-date'), '15-08-2024');
    fireEvent.changeText(screen.getByTestId('holiday-name'), 'Independence Day');

    fireEvent.press(screen.getByTestId('holiday-submit'));

    expect(await screen.findByTestId('holiday-error-date')).toBeOnTheScreen();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a holiday with the correct payload and invalidates the list', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithProviders(<HolidayFormScreen />, { queryClient });

    fireEvent.changeText(screen.getByTestId('holiday-date'), '2024-08-15');
    fireEvent.changeText(screen.getByTestId('holiday-name'), 'Independence Day');
    fireEvent.changeText(
      screen.getByTestId('holiday-description'),
      'National holiday',
    );

    fireEvent.press(screen.getByTestId('holiday-submit'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        date: '2024-08-15',
        name: 'Independence Day',
        description: 'National holiday',
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ADMIN_HOLIDAYS_QUERY_KEY,
      });
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('omits the description from the payload when left blank', async () => {
    renderWithProviders(<HolidayFormScreen />);

    fireEvent.changeText(screen.getByTestId('holiday-date'), '2024-08-15');
    fireEvent.changeText(screen.getByTestId('holiday-name'), 'Independence Day');

    fireEvent.press(screen.getByTestId('holiday-submit'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        date: '2024-08-15',
        name: 'Independence Day',
      });
    });
  });
});
