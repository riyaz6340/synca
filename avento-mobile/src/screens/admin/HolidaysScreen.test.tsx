/**
 * Component tests for the Admin HolidaysScreen (task 12.6).
 *
 * Covers the screen's contract:
 *  - fetches holidays via adminApi.getHolidays
 *  - renders them in chronological order — earliest first (Requirement 16.4)
 *  - shows each holiday's date, name, and description (Requirement 16.4)
 *  - the "Add Holiday" action navigates to HolidayForm (Requirement 16.2)
 *  - shows an error state (with retry) when the fetch fails
 *  - shows an empty state when there are no holidays
 *
 * adminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 16.1, 16.2, 16.4
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { Holiday } from '@/types/models';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getHolidays: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import HolidaysScreen from './HolidaysScreen';

const mockGetHolidays = adminApi.getHolidays as jest.Mock;

const HOLIDAYS: Holiday[] = [
  // Intentionally out of order to verify the screen sorts earliest-first.
  { id: 'h-mid', date: '2024-06-15', name: 'Mid Year Break', description: 'School closed' },
  { id: 'h-early', date: '2024-01-01', name: "New Year's Day" },
  { id: 'h-late', date: '2024-12-25', name: 'Winter Holiday', description: 'Festive break' },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('HolidaysScreen', () => {
  it('renders holidays in chronological order with date, name, and description', async () => {
    mockGetHolidays.mockResolvedValue(HOLIDAYS);

    renderWithProviders(<HolidaysScreen />);

    expect(await screen.findByText("New Year's Day")).toBeOnTheScreen();

    // Chronological ordering: earliest date first.
    const list = screen.getByTestId('holidays-list');
    const renderedOrder = JSON.stringify(list.props.data.map((h: Holiday) => h.id));
    expect(renderedOrder).toBe(JSON.stringify(['h-early', 'h-mid', 'h-late']));

    // Date, name, and description are surfaced.
    expect(screen.getByText('Mid Year Break')).toBeOnTheScreen();
    expect(screen.getByText('School closed')).toBeOnTheScreen();
    expect(screen.getByTestId('holiday-date-h-early')).toBeOnTheScreen();
  });

  it('navigates to HolidayForm when tapping Add Holiday', async () => {
    mockGetHolidays.mockResolvedValue(HOLIDAYS);

    renderWithProviders(<HolidaysScreen />);

    fireEvent.press(await screen.findByTestId('holidays-add'));

    expect(mockNavigate).toHaveBeenCalledWith('HolidayForm');
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetHolidays
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(HOLIDAYS);

    renderWithProviders(<HolidaysScreen />);

    expect(await screen.findByTestId('holidays-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByText("New Year's Day")).toBeOnTheScreen();
    expect(screen.queryByTestId('holidays-error')).toBeNull();
  });

  it('shows an empty state when there are no holidays', async () => {
    mockGetHolidays.mockResolvedValue([]);

    renderWithProviders(<HolidaysScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('holidays-empty')).toBeOnTheScreen();
    });
  });
});
