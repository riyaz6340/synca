/**
 * Component tests for the Admin AnnouncementsScreen (task 12.4).
 *
 * Covers the screen's contract:
 *  - fetches announcements via adminApi.getAnnouncements
 *  - renders them in reverse-chronological order (Requirement 14.1)
 *  - shows each item's publication status (Draft vs Published) derived from
 *    `published_at` (Requirement 14.5)
 *  - the "New Announcement" action navigates to AnnouncementForm
 *    (Requirement 14.2)
 *  - shows an error state (with retry) when the fetch fails
 *  - shows an empty state when there are no announcements
 *
 * adminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 14.1, 14.2, 14.5
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { Announcement } from '@/types/models';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getAnnouncements: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import AnnouncementsScreen from './AnnouncementsScreen';

const mockGetAnnouncements = adminApi.getAnnouncements as jest.Mock;

const ANNOUNCEMENTS: Announcement[] = [
  // Intentionally out of order to verify the screen sorts most-recent-first.
  { id: 'a-old', title: 'Older notice', body: 'Old body', published_at: '2024-01-01T08:00:00Z' },
  { id: 'a-new', title: 'Newest notice', body: 'New body', published_at: '2024-03-01T08:00:00Z' },
  // No published_at → Draft.
  { id: 'a-draft', title: 'Draft notice', body: 'Draft body', published_at: '' },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AnnouncementsScreen', () => {
  it('renders announcements in reverse-chronological order with publication status', async () => {
    mockGetAnnouncements.mockResolvedValue(ANNOUNCEMENTS);

    renderWithProviders(<AnnouncementsScreen />);

    expect(await screen.findByText('Newest notice')).toBeOnTheScreen();

    // Reverse-chronological ordering: newest row appears before the older one.
    const list = screen.getByTestId('announcements-list');
    const rendered = JSON.stringify(list.props.data.map((a: Announcement) => a.id));
    expect(rendered).toBe(JSON.stringify(['a-new', 'a-old', 'a-draft']));

    // Status indicators: published vs draft.
    expect(screen.getByTestId('announcement-status-a-new')).toHaveTextContent('Published');
    expect(screen.getByTestId('announcement-status-a-old')).toHaveTextContent('Published');
    expect(screen.getByTestId('announcement-status-a-draft')).toHaveTextContent('Draft');
  });

  it('navigates to AnnouncementForm when tapping New Announcement', async () => {
    mockGetAnnouncements.mockResolvedValue(ANNOUNCEMENTS);

    renderWithProviders(<AnnouncementsScreen />);

    fireEvent.press(await screen.findByTestId('announcements-new'));

    expect(mockNavigate).toHaveBeenCalledWith('AnnouncementForm');
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetAnnouncements
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(ANNOUNCEMENTS);

    renderWithProviders(<AnnouncementsScreen />);

    expect(await screen.findByTestId('announcements-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('error-state-retry'));

    expect(await screen.findByText('Newest notice')).toBeOnTheScreen();
    expect(screen.queryByTestId('announcements-error')).toBeNull();
  });

  it('shows an empty state when there are no announcements', async () => {
    mockGetAnnouncements.mockResolvedValue([]);

    renderWithProviders(<AnnouncementsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('announcements-empty')).toBeOnTheScreen();
    });
  });
});
