/**
 * Component tests for the SuperAdmin OrgFormScreen (task 14.2).
 *
 * Covers the screen's contract:
 *  - CREATE: submits the correct onboarding payload (name + admin email/password)
 *    via superAdminApi.createOrganization and returns to the list
 *    (Requirements 19.2, 19.3)
 *  - blocks submit with field errors when required fields are empty
 *  - EDIT: prefills from the existing record (list) and submits the full update
 *    via superAdminApi.updateOrganization (Requirement 19.5)
 *
 * superAdminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 19.2, 19.3, 19.5
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { OrganizationSummary } from '@/api/superadmin';
import type { Paginated } from '@/api/portal';

const mockGoBack = jest.fn();
let mockRouteParams: { orgId?: string } | undefined;

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/api/superadmin', () => ({
  __esModule: true,
  superAdminApi: {
    getOrganizations: jest.fn(),
    createOrganization: jest.fn(),
    updateOrganization: jest.fn(),
  },
}));

import { superAdminApi } from '@/api/superadmin';
import OrgFormScreen from './OrgFormScreen';

const mockGetOrganizations = superAdminApi.getOrganizations as jest.Mock;
const mockCreateOrganization = superAdminApi.createOrganization as jest.Mock;
const mockUpdateOrganization = superAdminApi.updateOrganization as jest.Mock;

const EXISTING: OrganizationSummary = {
  id: 'o-1',
  name: 'Springfield Elementary',
  industry_module: 'education',
  plan: 'premium',
  monthly_amount: 99,
  billing_status: 'active',
  person_count: 42,
  created_at: '2024-01-01T00:00:00.000Z',
};

function orgsPage(orgs: OrganizationSummary[]): Paginated<OrganizationSummary> {
  return {
    data: orgs,
    pagination: { page: 1, limit: 200, total: orgs.length, totalPages: 1 },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = undefined;
  mockGetOrganizations.mockResolvedValue(orgsPage([EXISTING]));
  mockCreateOrganization.mockResolvedValue({
    organization: { id: 'o-new', name: 'New Org' },
    admin_user: {
      id: 'u-1',
      email: 'admin@new.com',
      role: 'Admin',
      organization_id: 'o-new',
    },
  });
  mockUpdateOrganization.mockResolvedValue(EXISTING);
});

describe('OrgFormScreen — create mode', () => {
  it('blocks submit and shows field errors when required fields are empty', async () => {
    renderWithProviders(<OrgFormScreen />);

    fireEvent.press(screen.getByTestId('org-submit'));

    expect(await screen.findByTestId('org-error-name')).toBeOnTheScreen();
    expect(screen.getByTestId('org-error-email')).toBeOnTheScreen();
    expect(screen.getByTestId('org-error-password')).toBeOnTheScreen();
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('submits the correct onboarding payload via createOrganization', async () => {
    renderWithProviders(<OrgFormScreen />);

    fireEvent.changeText(screen.getByTestId('org-name'), 'New Org');
    fireEvent.changeText(screen.getByTestId('org-industry-module'), 'education');
    fireEvent.changeText(screen.getByTestId('org-admin-email'), 'admin@new.com');
    fireEvent.changeText(screen.getByTestId('org-admin-password'), 'secret123');

    fireEvent.press(screen.getByTestId('org-submit'));

    await waitFor(() => {
      expect(mockCreateOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Org',
          industry_module: 'education',
          admin_email: 'admin@new.com',
          admin_password: 'secret123',
        }),
      );
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });
});

describe('OrgFormScreen — edit mode', () => {
  beforeEach(() => {
    mockRouteParams = { orgId: 'o-1' };
  });

  it('prefills the form from the existing organization', async () => {
    renderWithProviders(<OrgFormScreen />);

    expect(await screen.findByDisplayValue('Springfield Elementary')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('99')).toBeOnTheScreen();
    // Create-only admin fields are not shown in edit mode.
    expect(screen.queryByTestId('org-admin-email')).toBeNull();
    expect(screen.queryByTestId('org-admin-password')).toBeNull();
  });

  it('submits the full update via updateOrganization and returns to the list', async () => {
    renderWithProviders(<OrgFormScreen />);

    await screen.findByDisplayValue('Springfield Elementary');
    fireEvent.changeText(screen.getByTestId('org-name'), 'Springfield Primary');
    fireEvent.changeText(screen.getByTestId('org-monthly-amount'), '149');

    fireEvent.press(screen.getByTestId('org-submit'));

    await waitFor(() => {
      expect(mockUpdateOrganization).toHaveBeenCalledWith(
        'o-1',
        expect.objectContaining({
          name: 'Springfield Primary',
          industry_module: 'education',
          plan: 'premium',
          monthly_amount: 149,
          billing_status: 'active',
        }),
      );
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });
});
