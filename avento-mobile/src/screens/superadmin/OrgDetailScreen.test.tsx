/**
 * Component tests for the SuperAdmin OrgDetailScreen (task 14.2).
 *
 * Covers the screen's contract:
 *  - fetches and renders org details incl. user/person counts and plan info
 *    (Requirement 19.4)
 *  - "Edit" navigates to OrgForm with { orgId } (Requirement 19.5)
 *  - shows an error state (with retry) when the fetch fails
 *
 * superAdminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 19.4, 19.5
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { OrganizationDetail } from '@/types/models';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { orgId: 'o-1' } }),
}));

jest.mock('@/api/superadmin', () => ({
  __esModule: true,
  superAdminApi: {
    getOrganizationDetail: jest.fn(),
  },
}));

import { superAdminApi } from '@/api/superadmin';
import OrgDetailScreen from './OrgDetailScreen';

const mockGetOrganizationDetail = superAdminApi.getOrganizationDetail as jest.Mock;

const DETAIL: OrganizationDetail = {
  id: 'o-1',
  name: 'Springfield Elementary',
  plan_type: 'premium',
  user_count: 5,
  person_count: 42,
  created_at: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OrgDetailScreen', () => {
  it('fetches and renders the org details with counts and plan info', async () => {
    mockGetOrganizationDetail.mockResolvedValue(DETAIL);

    renderWithProviders(<OrgDetailScreen />);

    expect(await screen.findByTestId('org-detail-name')).toHaveTextContent(
      'Springfield Elementary',
    );
    expect(screen.getByTestId('org-detail-user-count')).toHaveTextContent('5');
    expect(screen.getByTestId('org-detail-person-count')).toHaveTextContent('42');
    expect(screen.getByTestId('org-detail-plan-info')).toHaveTextContent('premium');

    expect(mockGetOrganizationDetail).toHaveBeenCalledWith('o-1');
  });

  it('navigates to OrgForm with the orgId on Edit', async () => {
    mockGetOrganizationDetail.mockResolvedValue(DETAIL);

    renderWithProviders(<OrgDetailScreen />);

    fireEvent.press(await screen.findByTestId('org-detail-edit'));

    expect(mockNavigate).toHaveBeenCalledWith('OrgForm', { orgId: 'o-1' });
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetOrganizationDetail
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(DETAIL);

    renderWithProviders(<OrgDetailScreen />);

    expect(await screen.findByTestId('org-detail-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByTestId('org-detail-name')).toHaveTextContent(
      'Springfield Elementary',
    );
  });
});
