/**
 * Component tests for the Admin AnnouncementFormScreen (task 12.4).
 *
 * Covers the screen's contract:
 *  - submits a valid Organization-targeted announcement with the correct
 *    payload via adminApi.createAnnouncement (Requirements 14.2, 14.4)
 *  - selecting "Group" reveals a multi-select group list loaded via
 *    adminApi.getGroups, and the chosen group ids are sent as target_ids
 *    (Requirement 14.3)
 *  - "Publish immediately" calls adminApi.publishAnnouncement for the created
 *    announcement (Requirement 14.4)
 *  - blocks submission with field-level errors when required fields are empty
 *    and makes NO create call
 *
 * adminApi and react-navigation are mocked so the screen is exercised in
 * isolation without network or a real navigator.
 *
 * Validates: Requirements 14.2, 14.3, 14.4
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { Group } from '@/types/models';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getGroups: jest.fn(),
    createAnnouncement: jest.fn(),
    publishAnnouncement: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import AnnouncementFormScreen from './AnnouncementFormScreen';

const mockGetGroups = adminApi.getGroups as jest.Mock;
const mockCreate = adminApi.createAnnouncement as jest.Mock;
const mockPublish = adminApi.publishAnnouncement as jest.Mock;

const GROUPS: Group[] = [
  { id: 'g-1', name: 'Class 1A', member_count: 30, attendance_marked_today: false },
  { id: 'g-2', name: 'Class 2B', member_count: 25, attendance_marked_today: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGroups.mockResolvedValue(GROUPS);
  mockCreate.mockResolvedValue({
    id: 'a-new',
    title: 'Hello',
    body: 'World',
    published_at: '',
  });
  mockPublish.mockResolvedValue(undefined);
});

describe('AnnouncementFormScreen', () => {
  it('blocks submit and shows field errors when required fields are empty', async () => {
    renderWithProviders(<AnnouncementFormScreen />);

    fireEvent.press(screen.getByTestId('announcement-submit'));

    expect(await screen.findByTestId('announcement-error-title')).toBeOnTheScreen();
    expect(screen.getByTestId('announcement-error-body')).toBeOnTheScreen();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates an Organization-targeted announcement with the correct payload', async () => {
    renderWithProviders(<AnnouncementFormScreen />);

    fireEvent.changeText(screen.getByTestId('announcement-title'), 'Hello');
    fireEvent.changeText(screen.getByTestId('announcement-body'), 'World');

    fireEvent.press(screen.getByTestId('announcement-submit'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        title: 'Hello',
        body: 'World',
        target_type: 'Organization',
      });
    });

    // No publish requested → stays a draft.
    expect(mockPublish).not.toHaveBeenCalled();
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('shows a multi-select group list when target type is Group and sends target_ids', async () => {
    renderWithProviders(<AnnouncementFormScreen />);

    fireEvent.changeText(screen.getByTestId('announcement-title'), 'Group notice');
    fireEvent.changeText(screen.getByTestId('announcement-body'), 'For classes');

    // Switch target type to Group → group list loads via getGroups.
    fireEvent.press(screen.getByTestId('announcement-target-Group'));

    expect(await screen.findByTestId('announcement-group-list')).toBeOnTheScreen();
    expect(mockGetGroups).toHaveBeenCalled();

    // Select two groups (multi-select).
    fireEvent.press(screen.getByTestId('announcement-group-g-1'));
    fireEvent.press(screen.getByTestId('announcement-group-g-2'));

    fireEvent.press(screen.getByTestId('announcement-submit'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        title: 'Group notice',
        body: 'For classes',
        target_type: 'Group',
        target_ids: ['g-1', 'g-2'],
      });
    });
  });

  it('blocks a Group announcement when no group is selected', async () => {
    renderWithProviders(<AnnouncementFormScreen />);

    fireEvent.changeText(screen.getByTestId('announcement-title'), 'Group notice');
    fireEvent.changeText(screen.getByTestId('announcement-body'), 'For classes');
    fireEvent.press(screen.getByTestId('announcement-target-Group'));

    await screen.findByTestId('announcement-group-list');

    fireEvent.press(screen.getByTestId('announcement-submit'));

    expect(await screen.findByTestId('announcement-error-target')).toBeOnTheScreen();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('publishes immediately when the publish toggle is enabled', async () => {
    renderWithProviders(<AnnouncementFormScreen />);

    fireEvent.changeText(screen.getByTestId('announcement-title'), 'Hello');
    fireEvent.changeText(screen.getByTestId('announcement-body'), 'World');

    fireEvent.press(screen.getByTestId('announcement-publish-toggle'));
    fireEvent.press(screen.getByTestId('announcement-submit'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('a-new'));
  });
});
