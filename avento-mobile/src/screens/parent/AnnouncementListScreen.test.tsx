/**
 * Component tests for AnnouncementListScreen (task 9.4).
 *
 * Covers the screen's contract:
 *  - fetches announcements via portalApi.getAnnouncements (React Query)
 *  - renders them in reverse-chronological order (Requirement 5.2)
 *  - shows title, body preview, and publication date (Requirement 5.2)
 *  - navigates to AnnouncementDetail with { announcementId } on tap (Req 5.3)
 *  - shows an empty state when there are no announcements
 *  - shows an error state with retry when the fetch fails
 *
 * portalApi is mocked so the screen is exercised without network access.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */
import {
  renderWithProviders,
  screen,
  fireEvent,
  waitFor,
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
import AnnouncementListScreen from './AnnouncementListScreen';

const mockGetAnnouncements = portalApi.getAnnouncements as jest.Mock;

// Deliberately unsorted so we can assert the screen orders them.
const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'old',
    title: 'Sports Day',
    body: 'Annual sports day will be held next month.',
    published_at: '2024-01-10T09:00:00Z',
  },
  {
    id: 'new',
    title: 'Holiday Notice',
    body: 'School will remain closed on Friday for a public holiday.',
    published_at: '2024-03-15T09:00:00Z',
  },
  {
    id: 'mid',
    title: 'PTA Meeting',
    body: 'Parent-teacher association meeting scheduled.',
    published_at: '2024-02-20T09:00:00Z',
  },
];

function makeNavigation() {
  return { navigate: jest.fn() } as any;
}

function makeRoute() {
  return { key: 'AnnouncementList', name: 'AnnouncementList', params: undefined } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AnnouncementListScreen', () => {
  it('fetches and renders announcements with title, preview, and date', async () => {
    mockGetAnnouncements.mockResolvedValue(ANNOUNCEMENTS);

    renderWithProviders(
      <AnnouncementListScreen navigation={makeNavigation()} route={makeRoute()} />,
    );

    expect(await screen.findByText('Holiday Notice')).toBeOnTheScreen();
    expect(screen.getByText('Sports Day')).toBeOnTheScreen();
    expect(screen.getByText('PTA Meeting')).toBeOnTheScreen();

    // Body preview is rendered.
    expect(
      screen.getByText(/School will remain closed on Friday/),
    ).toBeOnTheScreen();

    expect(mockGetAnnouncements).toHaveBeenCalledTimes(1);
  });

  it('renders announcements in reverse-chronological order', async () => {
    mockGetAnnouncements.mockResolvedValue(ANNOUNCEMENTS);

    renderWithProviders(
      <AnnouncementListScreen navigation={makeNavigation()} route={makeRoute()} />,
    );

    await screen.findByText('Holiday Notice');

    const items = screen.getAllByTestId(/^announcement-item-/);
    expect(items.map((i) => i.props.testID)).toEqual([
      'announcement-item-new', // 2024-03-15
      'announcement-item-mid', // 2024-02-20
      'announcement-item-old', // 2024-01-10
    ]);
  });

  it('navigates to the detail screen with the announcement id on tap', async () => {
    mockGetAnnouncements.mockResolvedValue(ANNOUNCEMENTS);
    const navigation = makeNavigation();

    renderWithProviders(
      <AnnouncementListScreen navigation={navigation} route={makeRoute()} />,
    );

    fireEvent.press(await screen.findByTestId('announcement-item-mid'));

    expect(navigation.navigate).toHaveBeenCalledWith('AnnouncementDetail', {
      announcementId: 'mid',
    });
  });

  it('shows an empty state when there are no announcements', async () => {
    mockGetAnnouncements.mockResolvedValue([]);

    renderWithProviders(
      <AnnouncementListScreen navigation={makeNavigation()} route={makeRoute()} />,
    );

    expect(await screen.findByTestId('announcements-empty')).toBeOnTheScreen();
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetAnnouncements.mockRejectedValueOnce(new Error('network down'));

    renderWithProviders(
      <AnnouncementListScreen navigation={makeNavigation()} route={makeRoute()} />,
    );

    expect(await screen.findByTestId('announcements-error')).toBeOnTheScreen();

    // Tapping retry re-invokes the query.
    mockGetAnnouncements.mockResolvedValueOnce(ANNOUNCEMENTS);
    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByText('Holiday Notice')).toBeOnTheScreen();
  });
});
