/**
 * Component tests for LoginScreen (task 8.1).
 *
 * Covers the screen's contract:
 *  - renders the organization dropdown, email, password fields and submit button
 *  - loads organizations from the auth API on mount
 *  - filters the organization list case-insensitively (via SearchableDropdown)
 *  - keeps the submit button disabled until org + email + password are provided
 *  - calls the auth store's login with the selected org name and id on submit
 *  - shows a friendly, internals-free error when login is rejected
 *
 * The auth API and auth store are mocked so the screen is exercised in
 * isolation without network or persistence.
 *
 * Validates: Requirements 1.1, 1.3, 24.1, 24.2, 24.3
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { Organization } from '@/types/models';

// --- Mocks ------------------------------------------------------------------

jest.mock('@/api/auth', () => ({
  __esModule: true,
  authApi: {
    fetchOrganizations: jest.fn(),
  },
}));

jest.mock('@/stores/auth', () => ({
  __esModule: true,
  useAuthStore: jest.fn(),
}));

import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import LoginScreen from './LoginScreen';

const mockFetchOrganizations = authApi.fetchOrganizations as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

const ORGS: Organization[] = [
  { id: 'org-1', name: 'Greenwood High' },
  { id: 'org-2', name: 'Riverside Academy' },
  { id: 'org-3', name: 'Greenfield School' },
];

interface MockState {
  login: jest.Mock;
  isLoading: boolean;
}

function primeStore(state: MockState): void {
  mockUseAuthStore.mockImplementation((selector: (s: MockState) => unknown) =>
    selector(state),
  );
}

function buildState(overrides: Partial<MockState> = {}): MockState {
  return {
    login: jest.fn().mockResolvedValue(undefined),
    isLoading: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchOrganizations.mockResolvedValue(ORGS);
});

/** Open the dropdown, type a search, and select the first matching option. */
async function selectOrganization(name: string, search: string): Promise<void> {
  fireEvent.press(screen.getByTestId('organization-dropdown-trigger'));
  const searchInput = await screen.findByTestId('organization-dropdown-search');
  fireEvent.changeText(searchInput, search);
  fireEvent.press(await screen.findByText(name));
}

describe('LoginScreen', () => {
  it('renders the organization dropdown, email, password fields and submit button', async () => {
    primeStore(buildState());

    render(<LoginScreen />);

    expect(screen.getByTestId('organization-dropdown')).toBeOnTheScreen();
    expect(screen.getByTestId('login-email')).toBeOnTheScreen();
    expect(screen.getByTestId('login-password')).toBeOnTheScreen();
    expect(screen.getByTestId('login-submit')).toBeOnTheScreen();

    // Organizations are loaded on mount.
    await waitFor(() => {
      expect(mockFetchOrganizations).toHaveBeenCalledTimes(1);
    });
  });

  it('filters organizations case-insensitively in the dropdown', async () => {
    primeStore(buildState());

    render(<LoginScreen />);
    await waitFor(() => expect(mockFetchOrganizations).toHaveBeenCalled());

    fireEvent.press(screen.getByTestId('organization-dropdown-trigger'));
    const searchInput = await screen.findByTestId(
      'organization-dropdown-search',
    );

    // Lowercase query matches both "Greenwood High" and "Greenfield School".
    fireEvent.changeText(searchInput, 'green');

    expect(await screen.findByText('Greenwood High')).toBeOnTheScreen();
    expect(screen.getByText('Greenfield School')).toBeOnTheScreen();
    expect(screen.queryByText('Riverside Academy')).toBeNull();
  });

  it('disables submit until org, email and password are all provided', async () => {
    primeStore(buildState());

    render(<LoginScreen />);
    await waitFor(() => expect(mockFetchOrganizations).toHaveBeenCalled());

    const submit = screen.getByTestId('login-submit');
    expect(submit.props.accessibilityState?.disabled).toBe(true);

    await selectOrganization('Greenwood High', 'green');
    fireEvent.changeText(screen.getByTestId('login-email'), 'user@example.com');
    // Still missing the password → remains disabled.
    expect(screen.getByTestId('login-submit').props.accessibilityState?.disabled).toBe(
      true,
    );

    fireEvent.changeText(screen.getByTestId('login-password'), 'secret');

    await waitFor(() => {
      expect(
        screen.getByTestId('login-submit').props.accessibilityState?.disabled,
      ).toBe(false);
    });
  });

  it('calls login with the selected organization name and id on submit', async () => {
    const state = buildState();
    primeStore(state);

    render(<LoginScreen />);
    await waitFor(() => expect(mockFetchOrganizations).toHaveBeenCalled());

    await selectOrganization('Riverside Academy', 'river');
    fireEvent.changeText(screen.getByTestId('login-email'), '  user@example.com  ');
    fireEvent.changeText(screen.getByTestId('login-password'), 'secret');

    fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => {
      expect(state.login).toHaveBeenCalledWith(
        'user@example.com',
        'secret',
        'Riverside Academy',
        'org-2',
      );
    });
  });

  it('shows a friendly error without internals when login is rejected', async () => {
    const state = buildState({
      login: jest.fn().mockRejectedValue(
        new Error('500: internal db connection string leaked'),
      ),
    });
    primeStore(state);

    render(<LoginScreen />);
    await waitFor(() => expect(mockFetchOrganizations).toHaveBeenCalled());

    await selectOrganization('Greenwood High', 'green');
    fireEvent.changeText(screen.getByTestId('login-email'), 'user@example.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'wrong');

    fireEvent.press(screen.getByTestId('login-submit'));

    expect(
      await screen.findByText('Invalid credentials. Please try again.'),
    ).toBeOnTheScreen();
    // The raw error internals must not be surfaced.
    expect(screen.queryByText(/internal db connection/i)).toBeNull();
  });
});
