/**
 * Component tests for AnnouncementDetailScreen (task 9.4).
 *
 * Covers the screen's contract:
 *  - resolves the announcement by the `announcementId` route param
 *  - renders the full title and complete body (Requirement 5.3)
 *  - shows an error state with retry when the fetch fails
 *  - shows a not-found state when the id doesn't match any announcement
 *
 * portalApi is mocked so the screen is exercised without network access.
 *
 * Validates: Requirements 5.1, 5.3
 */
import {
  renderWithProviders,
  screen,
  fireEvent,
} from '../../__tests__/utils/renderWithProviders';

import type { Announcement } from '@/types/models';

// --- Mocks ------------------------------------------------------------------

jest.mock('@/api/portal', () => ({
  __esModule: true,
  portalApi: {
    getAnnouncements: jest.fn(),
  },
}));

import { portalApi } from '@/api/portal';
import AnnouncementDetailScreen from './AnnouncementDetailScreen';

const mockGetAnnouncements = portalApi.getAnnouncements as jest.Mock;

const FULL_BODY =
  'School will remain closed on Friday for a public holiday. ' +
  'Classes will resume on Monday as usual. Please plan accordingly.';

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a1',
    title: 'Holiday Notice',
    body: FULL_BODY,
    published_at: '2024-03-15T09:00:00Z',
  },
  {
    id: 'a2',
    title: 'Sports Day',
    body: 'Annual sports day next month.',
    published_at: '2024-01-10T09:00:00Z',
  },
];

function makeNavigation() {
  return { navigate: jest.fn(), goBack: jest.fn() } as any;
}

function makeRoute(announcementId: string) {
  return {
    key: 'AnnouncementDetail',
    name: 'AnnouncementDetail',
    params: { announcementId },
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AnnouncementDetailScreen', () => {
  it('renders the full title and complete body for the selected announcement', async () => {
    mockGetAnnouncements.mockResolvedValue(ANNOUNCEMENTS);

    renderWithProviders(
      <AnnouncementDetailScreen
        navigation={makeNavigation()}
        route={makeRoute('a1')}
      />,
    );

    expect(await screen.findByText('Holiday Notice')).toBeOnTheScreen();
    // Full, untruncated body is shown.
    expect(screen.getByTestId('announcement-detail-body')).toHaveTextContent(
      FULL_BODY,
    );
  });

  it('shows a not-found state when the id does not match', async () => {
    mockGetAnnouncements.mockResolvedValue(ANNOUNCEMENTS);

    renderWithProviders(
      <AnnouncementDetailScreen
        navigation={makeNavigation()}
        route={makeRoute('does-not-exist')}
      />,
    );

    expect(
      await screen.findByTestId('announcement-detail-missing'),
    ).toBeOnTheScreen();
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetAnnouncements.mockRejectedValueOnce(new Error('network down'));

    renderWithProviders(
      <AnnouncementDetailScreen
        navigation={makeNavigation()}
        route={makeRoute('a1')}
      />,
    );

    expect(
      await screen.findByTestId('announcement-detail-error'),
    ).toBeOnTheScreen();

    mockGetAnnouncements.mockResolvedValueOnce(ANNOUNCEMENTS);
    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByText('Holiday Notice')).toBeOnTheScreen();
  });
});
