/**
 * Component tests for ChangePasswordScreen (task 9.9).
 *
 * Covers the screen's contract:
 *  - validation gates submission: a too-short new password and a
 *    new/confirm mismatch both block the API call and show a field error
 *    (Requirement 8.2)
 *  - an incorrect current password (backend 401) surfaces a friendly
 *    "Current password is incorrect." message (Requirement 8.3)
 *  - a successful change shows a success message and navigates back to Profile
 *    (Requirement 8.4)
 *
 * authApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';

// --- Mocks ------------------------------------------------------------------

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

jest.mock('@/api/auth', () => ({
  __esModule: true,
  authApi: {
    changePassword: jest.fn(),
  },
}));

import { authApi } from '@/api/auth';
import ChangePasswordScreen from './ChangePasswordScreen';

const mockChangePassword = authApi.changePassword as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockChangePassword.mockResolvedValue({ message: 'ok' });
});

/** Fill all three fields with the given values. */
function fillForm(current: string, next: string, confirm: string): void {
  fireEvent.changeText(screen.getByTestId('change-password-current'), current);
  fireEvent.changeText(screen.getByTestId('change-password-new'), next);
  fireEvent.changeText(screen.getByTestId('change-password-confirm'), confirm);
}

describe('ChangePasswordScreen', () => {
  it('blocks submit and shows an error when the new password is too short', async () => {
    renderWithProviders(<ChangePasswordScreen />);

    fillForm('oldpass', 'abc', 'abc');
    fireEvent.press(screen.getByTestId('change-password-submit'));

    expect(
      await screen.findByTestId('change-password-error-new'),
    ).toHaveTextContent('New password must be at least 6 characters.');
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('blocks submit and shows an error when new and confirm do not match', async () => {
    renderWithProviders(<ChangePasswordScreen />);

    fillForm('oldpass', 'newpass1', 'newpass2');
    fireEvent.press(screen.getByTestId('change-password-submit'));

    expect(
      await screen.findByTestId('change-password-error-confirm'),
    ).toHaveTextContent('New password and confirmation do not match.');
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('shows a friendly error when the current password is incorrect', async () => {
    mockChangePassword.mockRejectedValue({ response: { status: 401 } });

    renderWithProviders(<ChangePasswordScreen />);

    fillForm('wrongpass', 'newpass1', 'newpass1');
    fireEvent.press(screen.getByTestId('change-password-submit'));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith({
        current_password: 'wrongpass',
        new_password: 'newpass1',
      }),
    );

    expect(
      await screen.findByTestId('change-password-submit-error'),
    ).toHaveTextContent('Current password is incorrect.');
  });

  it('shows success and navigates back on a successful change', async () => {
    renderWithProviders(<ChangePasswordScreen />);

    fillForm('oldpass', 'newpass1', 'newpass1');
    fireEvent.press(screen.getByTestId('change-password-submit'));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith({
        current_password: 'oldpass',
        new_password: 'newpass1',
      }),
    );

    expect(
      await screen.findByTestId('change-password-success'),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('change-password-success-done'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
