/**
 * Component tests for ProfileScreen (task 9.9).
 *
 * Covers the screen's contract:
 *  - shows the authenticated user's email and role from the auth store
 *  - navigates to ChangePassword when the row is tapped (Requirement 8.1)
 *  - calls logout when the logout button is tapped (Requirement 1.7)
 *  - shows the biometric toggle only when biometric hardware is available, and
 *    wires it to enableBiometric / disableBiometric (Requirement 1.8)
 *
 * The auth store, biometric service and react-navigation are mocked so the
 * screen is exercised in isolation.
 *
 * Validates: Requirements 8.1, 1.7, 1.8
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { AppUser } from '@/types/auth';

// --- Mocks ------------------------------------------------------------------

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

jest.mock('@/stores/auth', () => ({
  __esModule: true,
  useAuthStore: jest.fn(),
}));

jest.mock('@/services/biometric', () => ({
  __esModule: true,
  biometric: {
    checkAvailability: jest.fn(),
  },
}));

import { biometric } from '@/services/biometric';
import { useAuthStore } from '@/stores/auth';
import ProfileScreen from './ProfileScreen';

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockCheckAvailability = biometric.checkAvailability as jest.Mock;

const USER: AppUser = {
  id: 'u-1',
  email: 'parent@example.com',
  role: 'Stakeholder',
  organization_id: 'org-1',
};

interface MockState {
  user: AppUser | null;
  biometricEnabled: boolean;
  enableBiometric: jest.Mock;
  disableBiometric: jest.Mock;
  logout: jest.Mock;
}

function buildState(overrides: Partial<MockState> = {}): MockState {
  return {
    user: USER,
    biometricEnabled: false,
    enableBiometric: jest.fn().mockResolvedValue(undefined),
    disableBiometric: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function primeStore(state: MockState): void {
  mockUseAuthStore.mockImplementation((selector: (s: MockState) => unknown) =>
    selector(state),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckAvailability.mockResolvedValue({ available: true, supportedTypes: [] });
});

describe('ProfileScreen', () => {
  it('shows the user email and role', async () => {
    primeStore(buildState());

    render(<ProfileScreen />);

    // Let the async biometric availability probe settle.
    await screen.findByTestId('profile-biometric-row');

    expect(screen.getByTestId('profile-email')).toHaveTextContent(
      'parent@example.com',
    );
    expect(screen.getByTestId('profile-role')).toHaveTextContent('Parent');
  });

  it('navigates to ChangePassword when the row is tapped', async () => {
    primeStore(buildState());

    render(<ProfileScreen />);
    await screen.findByTestId('profile-biometric-row');

    fireEvent.press(screen.getByTestId('profile-change-password'));
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('calls logout when the logout button is tapped', async () => {
    const state = buildState();
    primeStore(state);

    render(<ProfileScreen />);
    await screen.findByTestId('profile-biometric-row');

    fireEvent.press(screen.getByTestId('profile-logout'));
    await waitFor(() => expect(state.logout).toHaveBeenCalledTimes(1));
  });

  it('shows the biometric toggle and enables biometric login when turned on', async () => {
    const state = buildState();
    primeStore(state);

    render(<ProfileScreen />);

    const toggle = await screen.findByTestId('profile-biometric-toggle');
    fireEvent(toggle, 'valueChange', true);

    await waitFor(() => expect(state.enableBiometric).toHaveBeenCalledTimes(1));
  });

  it('disables biometric login when toggled off', async () => {
    const state = buildState({ biometricEnabled: true });
    primeStore(state);

    render(<ProfileScreen />);

    const toggle = await screen.findByTestId('profile-biometric-toggle');
    fireEvent(toggle, 'valueChange', false);

    expect(state.disableBiometric).toHaveBeenCalledTimes(1);
  });

  it('hides the biometric toggle when hardware is unavailable', async () => {
    mockCheckAvailability.mockResolvedValue({
      available: false,
      reason: 'no_hardware',
      supportedTypes: [],
    });
    primeStore(buildState());

    render(<ProfileScreen />);

    // Wait for the availability probe to settle, then confirm no toggle.
    await waitFor(() => expect(mockCheckAvailability).toHaveBeenCalled());
    expect(screen.queryByTestId('profile-biometric-toggle')).toBeNull();
  });
});
