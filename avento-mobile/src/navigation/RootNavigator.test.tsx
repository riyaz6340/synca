/**
 * Tests for RootNavigator routing logic.
 *
 * Two layers of coverage:
 *  1. Pure route-selection (`resolveRootRoute` / `tabsRouteForRole`) — exhaustive,
 *     deterministic, no rendering. This is the heart of the auth-flow routing.
 *  2. Component render — mounts RootNavigator with a mocked auth store and
 *     asserts the correct top-level destination is shown for each state:
 *     unauthenticated → AuthStack, role → correct tabs, and the biometric gate.
 *
 * Validates: Requirements 1.1, 1.4, 1.9, 2.4
 */

import {
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';

import type { AppRole, AppUser } from '@/types/auth';

import RootNavigator, {
  resolveRootRoute,
  tabsRouteForRole,
} from './RootNavigator';

// --- Mocks ------------------------------------------------------------------

jest.mock('@/stores/auth', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/services/biometric', () => ({
  biometric: {
    authenticate: jest.fn(),
    checkAvailability: jest.fn(),
  },
}));

// Push-notification wiring runs in an effect on mount. Mock the native module
// and the service so the effect is inert (no permissions/token/listeners) while
// these routing-focused tests render.
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('@/services/pushNotifications', () => ({
  pushNotifications: {
    setNavigationHandler: jest.fn(),
    configureForegroundBehavior: jest.fn(),
    handleNotificationTapped: jest.fn(),
    handleNotificationReceived: jest.fn(),
    registerToken: jest.fn(() => Promise.resolve()),
    unregister: jest.fn(() => Promise.resolve()),
  },
}));

// Navigation state persistence: always resolve immediately with no stored state
// so the navigator mounts straight away without blocking on AsyncStorage.
jest.mock('./navigationState', () => ({
  loadNavigationState: jest.fn(() => Promise.resolve(undefined)),
  persistNavigationState: jest.fn(),
  clearNavigationState: jest.fn(() => Promise.resolve()),
}));

// The Parent tab now mounts the real HomeScreen + announcements badge, both of
// which call the portal API via React Query. Stub it so this routing-focused
// test stays deterministic and offline.
jest.mock('@/api/portal', () => ({
  portalApi: {
    getPersons: jest.fn(() => Promise.resolve([])),
    getAnnouncements: jest.fn(() => Promise.resolve([])),
  },
}));

// The Admin tab now mounts the real DashboardScreen + a pending-leave tab badge,
// both of which call the admin API via React Query. Stub it so this
// routing-focused test stays deterministic and offline.
jest.mock('@/api/admin', () => ({
  adminApi: {
    getDashboard: jest.fn(() =>
      Promise.resolve({
        date: '2025-01-01',
        total_students: 0,
        present: 0,
        absent: 0,
        late: 0,
        on_leave: 0,
        present_percentage: 0,
        absent_percentage: 0,
        late_percentage: 0,
        on_leave_percentage: 0,
        pending_leave_requests: 0,
        groups_not_marked: 0,
      }),
    ),
    getLeaveRequests: jest.fn(() =>
      Promise.resolve({ data: [], page: 1, limit: 100, total: 0 }),
    ),
  },
}));

// The SuperAdmin tab now mounts the real PlatformDashboardScreen, which calls
// the superadmin API via React Query. Stub it so this routing-focused test
// stays deterministic and offline.
jest.mock('@/api/superadmin', () => ({
  superAdminApi: {
    getPlatformDashboard: jest.fn(() =>
      Promise.resolve({
        overview: {
          total_organizations: 0,
          total_persons: 0,
          total_users: 0,
          total_attendance_records: 0,
          monthly_revenue: 0,
        },
        plan_breakdown: [],
        industry_breakdown: [],
        billing_breakdown: [],
        today_attendance: [],
        recent_organizations: [],
        organizations_by_size: [],
      }),
    ),
  },
}));

import { useAuthStore } from '@/stores/auth';
import { biometric } from '@/services/biometric';
import { pushNotifications } from '@/services/pushNotifications';

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockBiometric = biometric as jest.Mocked<typeof biometric>;
const mockPush = pushNotifications as unknown as {
  setNavigationHandler: jest.Mock;
  configureForegroundBehavior: jest.Mock;
  registerToken: jest.Mock;
  unregister: jest.Mock;
};

interface MockState {
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  token: string | null;
  user: AppUser | null;
  restoreSession: jest.Mock;
  logout: jest.Mock;
}

function buildState(overrides: Partial<MockState> = {}): MockState {
  return {
    isAuthenticated: false,
    isLoading: false,
    biometricEnabled: false,
    token: null,
    user: null,
    restoreSession: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function primeStore(state: MockState): void {
  // The component reads state via selector functions: useAuthStore((s) => s.x).
  mockUseAuthStore.mockImplementation((selector: (s: MockState) => unknown) =>
    selector(state),
  );
}

function userWithRole(role: AppRole): AppUser {
  return { id: 'u1', email: 'u@example.com', role, organization_id: 'org-1' };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBiometric.authenticate.mockResolvedValue(true);
  mockBiometric.checkAvailability.mockResolvedValue({
    available: true,
    supportedTypes: [],
  });
});

// --- Pure route-selection logic ---------------------------------------------

describe('tabsRouteForRole', () => {
  it('maps Admin to AdminTabs', () => {
    expect(tabsRouteForRole('Admin')).toBe('AdminTabs');
  });

  it('maps SuperAdmin to SuperAdminTabs', () => {
    expect(tabsRouteForRole('SuperAdmin')).toBe('SuperAdminTabs');
  });

  it('maps Stakeholder (Parent) to ParentTabs', () => {
    expect(tabsRouteForRole('Stakeholder')).toBe('ParentTabs');
  });

  it('falls back to ParentTabs for an unknown/missing role', () => {
    expect(tabsRouteForRole(null)).toBe('ParentTabs');
    expect(tabsRouteForRole(undefined)).toBe('ParentTabs');
  });
});

describe('resolveRootRoute', () => {
  it('routes unauthenticated users to Auth regardless of other flags', () => {
    expect(
      resolveRootRoute({
        isAuthenticated: false,
        biometricEnabled: true,
        biometricVerified: false,
        role: 'Admin',
      }),
    ).toBe('Auth');
  });

  it('routes to the biometric gate when enabled and not yet verified', () => {
    expect(
      resolveRootRoute({
        isAuthenticated: true,
        biometricEnabled: true,
        biometricVerified: false,
        role: 'Stakeholder',
      }),
    ).toBe('Biometric');
  });

  it('routes past the gate once biometric is verified', () => {
    expect(
      resolveRootRoute({
        isAuthenticated: true,
        biometricEnabled: true,
        biometricVerified: true,
        role: 'Stakeholder',
      }),
    ).toBe('ParentTabs');
  });

  it('routes straight to role tabs when biometric is not enabled', () => {
    expect(
      resolveRootRoute({
        isAuthenticated: true,
        biometricEnabled: false,
        biometricVerified: false,
        role: 'SuperAdmin',
      }),
    ).toBe('SuperAdminTabs');
  });
});

// --- Component rendering ----------------------------------------------------

describe('RootNavigator rendering', () => {
  it('shows the login screen when unauthenticated', async () => {
    primeStore(buildState({ isAuthenticated: false }));

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(screen.getByText('Sign In')).toBeOnTheScreen();
    });
  });

  it('calls restoreSession on mount', async () => {
    const state = buildState({ isAuthenticated: false });
    primeStore(state);

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(state.restoreSession).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the Admin tabs (Dashboard) for an authenticated Admin', async () => {
    primeStore(
      buildState({ isAuthenticated: true, user: userWithRole('Admin') }),
    );

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-total-students')).toBeOnTheScreen();
    });
  });

  it('shows the Parent tabs (Home) for an authenticated Stakeholder', async () => {
    primeStore(
      buildState({ isAuthenticated: true, user: userWithRole('Stakeholder') }),
    );

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeOnTheScreen();
    });
  });

  it('shows the SuperAdmin tabs (PlatformDashboard) for an authenticated SuperAdmin', async () => {
    primeStore(
      buildState({ isAuthenticated: true, user: userWithRole('SuperAdmin') }),
    );

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(
        screen.getByTestId('platform-total-organizations'),
      ).toBeOnTheScreen();
    });
  });

  it('gates an authenticated user behind the biometric prompt when enabled', async () => {
    // Keep the prompt from auto-passing so the gate UI stays visible.
    mockBiometric.authenticate.mockResolvedValue(false);
    primeStore(
      buildState({
        isAuthenticated: true,
        biometricEnabled: true,
        user: userWithRole('Admin'),
      }),
    );

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(screen.getByText('Use password instead')).toBeOnTheScreen();
    });
    // The role tabs must NOT be reachable while the gate is unmet.
    expect(screen.queryByTestId('dashboard-total-students')).toBeNull();
  });

  it('reveals role tabs after the biometric prompt succeeds', async () => {
    mockBiometric.authenticate.mockResolvedValue(true);
    primeStore(
      buildState({
        isAuthenticated: true,
        biometricEnabled: true,
        user: userWithRole('Admin'),
      }),
    );

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-total-students')).toBeOnTheScreen();
    });
  });
});

// --- Push-notification wiring -----------------------------------------------

describe('RootNavigator push-notification wiring', () => {
  it('registers the push navigation handler and foreground behavior on mount', async () => {
    primeStore(buildState({ isAuthenticated: false }));

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(mockPush.setNavigationHandler).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
    expect(mockPush.configureForegroundBehavior).toHaveBeenCalledTimes(1);
  });

  it('registers the device push token when authenticated with a token', async () => {
    primeStore(
      buildState({
        isAuthenticated: true,
        token: 'jwt-abc',
        user: userWithRole('Stakeholder'),
      }),
    );

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(mockPush.registerToken).toHaveBeenCalledWith('jwt-abc');
    });
  });

  it('does not register a push token while unauthenticated', async () => {
    primeStore(buildState({ isAuthenticated: false, token: null }));

    renderWithProviders(<RootNavigator />);

    await waitFor(() => {
      expect(mockPush.setNavigationHandler).toHaveBeenCalled();
    });
    expect(mockPush.registerToken).not.toHaveBeenCalled();
  });
});
