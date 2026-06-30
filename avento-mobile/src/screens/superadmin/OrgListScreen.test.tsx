/**
 * Component tests for the SuperAdmin OrgListScreen (task 14.2).
 *
 * Covers the screen's contract:
 *  - fetches and renders the paginated organizations list (Requirement 19.1)
 *  - typing in the search box re-fetches with the `search` param
 *  - tapping a row navigates to OrgDetail with { orgId } (Requirement 19.4)
 *  - "Add Organization" navigates to OrgForm in create mode (Requirement 19.2)
 *  - shows an error state (with retry) when the fetch fails
 *  - shows an empty state when no organizations match
 *
 * superAdminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 19.1, 19.2, 19.4
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { OrganizationSummary } from '@/api/superadmin';
import type { Paginated } from '@/api/portal';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/api/superadmin', () => ({
  __esModule: true,
  superAdminApi: {
    getOrganizations: jest.fn(),
  },
}));

import { superAdminApi } from '@/api/superadmin';
import OrgListScreen from './OrgListScreen';

const mockGetOrganizations = superAdminApi.getOrganizations as jest.Mock;

const ORGS: OrganizationSummary[] = [
  {
    id: 'o-1',
    name: 'Springfield Elementary',
    industry_module: 'education',
    plan: 'premium',
    monthly_amount: 99,
    billing_status: 'active',
    person_count: 42,
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'o-2',
    name: 'Shelbyville High',
    industry_module: 'education',
    plan: 'basic',
    monthly_amount: 49,
    billing_status: 'trial',
    person_count: 1,
    created_at: '2024-02-01T00:00:00.000Z',
  },
];

function page(orgs: OrganizationSummary[], totalPages = 1): Paginated<OrganizationSummary> {
  return {
    data: orgs,
    pagination: { page: 1, limit: 20, total: orgs.length, totalPages },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OrgListScreen', () => {
  it('fetches and renders the organizations list', async () => {
    mockGetOrganizations.mockResolvedValue(page(ORGS));

    renderWithProviders(<OrgListScreen />);

    expect(await screen.findByText('Springfield Elementary')).toBeOnTheScreen();
    expect(screen.getByText('Shelbyville High')).toBeOnTheScreen();

    // Plan + person count per row.
    expect(screen.getByTestId('org-plan-o-1')).toHaveTextContent('premium');
    expect(screen.getByText('42 people')).toBeOnTheScreen();
    expect(screen.getByText('1 person')).toBeOnTheScreen();
  });

  it('re-fetches with the search param when the user types', async () => {
    mockGetOrganizations.mockResolvedValue(page(ORGS));

    renderWithProviders(<OrgListScreen />);
    await screen.findByText('Springfield Elementary');

    fireEvent.changeText(screen.getByTestId('org-list-search'), 'Shelby');

    await waitFor(() => {
      expect(mockGetOrganizations).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Shelby', page: 1 }),
      );
    });
  });

  it('navigates to OrgDetail with the orgId on row tap', async () => {
    mockGetOrganizations.mockResolvedValue(page(ORGS));

    renderWithProviders(<OrgListScreen />);

    fireEvent.press(await screen.findByTestId('org-row-o-1'));

    expect(mockNavigate).toHaveBeenCalledWith('OrgDetail', { orgId: 'o-1' });
  });

  it('navigates to OrgForm in create mode from "Add Organization"', async () => {
    mockGetOrganizations.mockResolvedValue(page(ORGS));

    renderWithProviders(<OrgListScreen />);
    await screen.findByText('Springfield Elementary');

    fireEvent.press(screen.getByTestId('org-list-add'));

    expect(mockNavigate).toHaveBeenCalledWith('OrgForm');
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetOrganizations
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(page(ORGS));

    renderWithProviders(<OrgListScreen />);

    expect(await screen.findByTestId('org-list-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByText('Springfield Elementary')).toBeOnTheScreen();
    expect(screen.queryByTestId('org-list-error')).toBeNull();
  });

  it('shows an empty state when no organizations match', async () => {
    mockGetOrganizations.mockResolvedValue(page([]));

    renderWithProviders(<OrgListScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('org-list-empty')).toBeOnTheScreen();
    });
  });
});
