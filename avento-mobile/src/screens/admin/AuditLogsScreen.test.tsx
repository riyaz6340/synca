/**
 * Component tests for the Admin AuditLogsScreen (task 12.7).
 *
 * Covers the screen's contract:
 *  - fetches audit logs via adminApi.getAuditLogs and renders each entry's
 *    action, entity type, user, and a (formatted) timestamp (Requirement 17.2)
 *  - loads the next page when the list end is reached (infinite scroll) and
 *    shows a footer loader while fetching (Requirement 17.3)
 *  - stops paging once a short/partial final page is returned (the endpoint
 *    returns a bare array with no total-count metadata) (Requirement 17.1)
 *  - shows an empty state when there are no entries
 *
 * adminApi is mocked so the screen is exercised in isolation without network.
 *
 * Validates: Requirements 17.1, 17.2, 17.3
 */

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/__tests__/utils/renderWithProviders';
import type { AuditLogEntry } from '@/types/models';

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getAuditLogs: jest.fn(),
  },
}));

import { adminApi } from '@/api/admin';
import AuditLogsScreen from './AuditLogsScreen';

const mockGetAuditLogs = adminApi.getAuditLogs as jest.Mock;

const PAGE_SIZE = 50;

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'log-1',
    action: 'CREATE',
    entity_type: 'Person',
    entity_id: 'p-1',
    user_id: 'u-1',
    user_email: 'admin@example.com',
    timestamp: '2024-01-01T08:00:00Z',
    ...overrides,
  };
}

/** Build a full page (PAGE_SIZE entries) so the screen keeps paging. */
function makeFullPage(prefix: string): AuditLogEntry[] {
  return Array.from({ length: PAGE_SIZE }, (_unused, index: number) =>
    makeEntry({ id: `${prefix}-${index}`, action: `ACTION_${prefix}_${index}` }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuditLogsScreen', () => {
  it('renders entries with action, entity type, user and timestamp', async () => {
    mockGetAuditLogs.mockResolvedValueOnce([
      makeEntry({
        id: 'log-a',
        action: 'UPDATE',
        entity_type: 'Group',
        user_email: 'teacher@example.com',
        timestamp: '2024-05-01T10:30:00Z',
      }),
    ]);

    renderWithProviders(<AuditLogsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-log-item-log-a')).toBeOnTheScreen(),
    );

    const row = screen.getByTestId('audit-log-item-log-a');
    expect(within(row).getByTestId('audit-log-action-log-a')).toHaveTextContent(
      'UPDATE',
    );
    expect(within(row).getByTestId('audit-log-entity-log-a')).toHaveTextContent(
      'Group',
    );
    expect(within(row).getByTestId('audit-log-user-log-a')).toHaveTextContent(
      'teacher@example.com',
    );
    // Timestamp is rendered (formatted); just assert the node exists.
    expect(
      within(row).getByTestId('audit-log-timestamp-log-a'),
    ).toBeOnTheScreen();

    expect(mockGetAuditLogs).toHaveBeenCalledWith({ page: 1, limit: PAGE_SIZE });
  });

  it('loads the next page when the end of the list is reached', async () => {
    mockGetAuditLogs
      .mockResolvedValueOnce(makeFullPage('p1'))
      .mockResolvedValueOnce([makeEntry({ id: 'p2-0', action: 'SECOND_PAGE' })]);

    renderWithProviders(<AuditLogsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-log-item-p1-0')).toBeOnTheScreen(),
    );
    expect(mockGetAuditLogs).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('audit-logs-list'), 'onEndReached');

    // The next page is requested and appended. We assert against the list's
    // `data` prop rather than a rendered node, because FlatList virtualizes
    // and the page-2 entry (index 50) falls outside the rendered window.
    await waitFor(() => expect(mockGetAuditLogs).toHaveBeenCalledTimes(2));
    expect(mockGetAuditLogs).toHaveBeenLastCalledWith({
      page: 2,
      limit: PAGE_SIZE,
    });

    await waitFor(() => {
      const data = screen.getByTestId('audit-logs-list').props
        .data as AuditLogEntry[];
      expect(data).toHaveLength(PAGE_SIZE + 1);
      expect(data[PAGE_SIZE]?.id).toBe('p2-0');
    });
  });

  it('stops paging once a short final page is returned', async () => {
    // First page is partial (< PAGE_SIZE) → there is no next page to load.
    mockGetAuditLogs.mockResolvedValueOnce([
      makeEntry({ id: 'only-0' }),
      makeEntry({ id: 'only-1' }),
    ]);

    renderWithProviders(<AuditLogsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-log-item-only-0')).toBeOnTheScreen(),
    );

    // Reaching the end must not trigger another fetch.
    fireEvent(screen.getByTestId('audit-logs-list'), 'onEndReached');

    await waitFor(() =>
      expect(mockGetAuditLogs).toHaveBeenCalledTimes(1),
    );
  });

  it('shows an empty state when there are no entries', async () => {
    mockGetAuditLogs.mockResolvedValueOnce([]);

    renderWithProviders(<AuditLogsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-logs-empty')).toBeOnTheScreen(),
    );
  });

  it('shows an error state with retry when the fetch fails', async () => {
    mockGetAuditLogs
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([makeEntry({ id: 'recovered' })]);

    renderWithProviders(<AuditLogsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-logs-error')).toBeOnTheScreen(),
    );

    fireEvent.press(screen.getByTestId('error-state-retry'));

    await waitFor(() =>
      expect(screen.getByTestId('audit-log-item-recovered')).toBeOnTheScreen(),
    );
  });
});
