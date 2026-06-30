/**
 * Component tests for the Admin ReportsScreen (task 12.5).
 *
 * Covers the screen's contract:
 *  - Generate Report fetches with the chosen date range + group params
 *    (Requirements 15.1, 15.2)
 *  - The report renders as a table with one row per student showing counts and
 *    the attendance percentage (Requirement 15.3)
 *  - An empty state is shown when the report has no rows
 *  - Export PDF requests the bytes and hands them to the share wrapper
 *    (Requirement 15.4)
 *
 * adminApi and the shareFile wrapper are mocked so the screen is exercised in
 * isolation without network or native modules.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 */
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from '@/__tests__/utils/renderWithProviders';
import type { AttendanceReport, Group } from '@/types/models';

jest.mock('@/api/admin', () => ({
  __esModule: true,
  adminApi: {
    getGroups: jest.fn(),
    getReports: jest.fn(),
    exportReportPdf: jest.fn(),
  },
}));

jest.mock('@/components/DateRangePicker', () =>
  require('@/__tests__/mocks/DateRangePicker'),
);

jest.mock('@/services/shareFile', () => ({
  __esModule: true,
  sharePdf: jest.fn(),
  ShareUnavailableError: class ShareUnavailableError extends Error {},
}));

import { adminApi } from '@/api/admin';
import { sharePdf } from '@/services/shareFile';
import ReportsScreen from './ReportsScreen';

const mockGetGroups = adminApi.getGroups as jest.Mock;
const mockGetReports = adminApi.getReports as jest.Mock;
const mockExportReportPdf = adminApi.exportReportPdf as jest.Mock;
const mockSharePdf = sharePdf as jest.Mock;

const GROUPS: Group[] = [
  { id: 'g-1', name: 'Class 1A', member_count: 30, attendance_marked_today: false },
  { id: 'g-2', name: 'Class 2B', member_count: 25, attendance_marked_today: true },
];

const REPORT_ROWS: AttendanceReport[] = [
  {
    person_id: 'p-1',
    person_name: 'Ada Lovelace',
    present_count: 18,
    absent_count: 1,
    late_count: 1,
    on_leave_count: 0,
    total_days: 20,
    attendance_percentage: 90,
  },
  {
    person_id: 'p-2',
    person_name: 'Alan Turing',
    present_count: 15,
    absent_count: 3,
    late_count: 2,
    on_leave_count: 0,
    total_days: 20,
    attendance_percentage: 75,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGroups.mockResolvedValue(GROUPS);
});

/** Fill the date range and tap Generate Report. */
function fillDatesAndGenerate(start = '2024-01-01', end = '2024-01-31') {
  fireEvent.changeText(screen.getByTestId('reports-date-range-start'), start);
  fireEvent.changeText(screen.getByTestId('reports-date-range-end'), end);
  fireEvent.press(screen.getByTestId('reports-generate'));
}

describe('ReportsScreen', () => {
  it('fetches the report with the selected date range and group params', async () => {
    mockGetReports.mockResolvedValue({ persons: REPORT_ROWS });

    renderWithProviders(<ReportsScreen />);

    // Group dropdown is populated from getGroups; select Class 1A.
    await waitFor(() => expect(mockGetGroups).toHaveBeenCalled());
    fireEvent.press(screen.getByTestId('reports-group-dropdown-trigger'));
    fireEvent.press(await screen.findByText('Class 1A'));

    fillDatesAndGenerate('2024-01-01', '2024-01-31');

    await waitFor(() =>
      expect(mockGetReports).toHaveBeenCalledWith({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        group_id: 'g-1',
      }),
    );
  });

  it('renders the report as a table with per-student counts and percentages', async () => {
    mockGetReports.mockResolvedValue({ persons: REPORT_ROWS });

    renderWithProviders(<ReportsScreen />);
    fillDatesAndGenerate();

    expect(await screen.findByTestId('report-table')).toBeOnTheScreen();
    expect(screen.getByTestId('report-row-p-1')).toBeOnTheScreen();
    expect(screen.getByText('Ada Lovelace')).toBeOnTheScreen();
    expect(screen.getByText('Alan Turing')).toBeOnTheScreen();

    // Percentages render per row.
    expect(screen.getByTestId('report-row-p-1-percentage')).toHaveTextContent('90%');
    expect(screen.getByTestId('report-row-p-2-percentage')).toHaveTextContent('75%');
  });

  it('shows an empty state when the report has no rows', async () => {
    mockGetReports.mockResolvedValue({ persons: [] });

    renderWithProviders(<ReportsScreen />);
    fillDatesAndGenerate();

    expect(await screen.findByTestId('reports-empty')).toBeOnTheScreen();
  });

  it('exports the PDF and hands the bytes to the share wrapper', async () => {
    const pdfBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    mockGetReports.mockResolvedValue({ persons: REPORT_ROWS });
    mockExportReportPdf.mockResolvedValue(pdfBytes);
    mockSharePdf.mockResolvedValue(undefined);

    renderWithProviders(<ReportsScreen />);
    fillDatesAndGenerate('2024-02-01', '2024-02-28');

    // Export button only appears once a report with rows is loaded.
    const exportBtn = await screen.findByTestId('reports-export');
    fireEvent.press(exportBtn);

    await waitFor(() =>
      expect(mockExportReportPdf).toHaveBeenCalledWith({
        start_date: '2024-02-01',
        end_date: '2024-02-28',
      }),
    );
    await waitFor(() => expect(mockSharePdf).toHaveBeenCalledTimes(1));
    expect(mockSharePdf.mock.calls[0][0]).toBe(pdfBytes);
  });
});
