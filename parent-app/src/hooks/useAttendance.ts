import { useState, useEffect, useCallback, useRef } from 'react';
import type { ViewState, AttendanceRecord, DateRange } from '../api/types';
import { portalApi } from '../api/endpoints';
import { isValidDateFormat, isValidRange } from '../lib/dates';
import { sortAttendanceByDateDesc } from '../lib/sorting';

/**
 * Hook to fetch and manage attendance records for a given person and date range.
 *
 * Only fetches when both `personId` and `range` are provided, and the range
 * passes date-format and ordering validation. Results are sorted by date descending.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5, 4.7
 */
export function useAttendance(
  personId: string | null,
  range: DateRange | null,
): { state: ViewState<AttendanceRecord[]>; retry: () => void } {
  const [state, setState] = useState<ViewState<AttendanceRecord[]>>({ status: 'loading' });

  // Keep a ref to the latest personId and range so retry() always uses current values
  const personIdRef = useRef(personId);
  const rangeRef = useRef(range);
  personIdRef.current = personId;
  rangeRef.current = range;

  const fetchAttendance = useCallback(async () => {
    const pid = personIdRef.current;
    const r = rangeRef.current;

    // Guard: only fetch when both params are provided and range is valid
    if (!pid || !r) {
      setState({ status: 'loading' });
      return;
    }

    if (
      !isValidDateFormat(r.start_date) ||
      !isValidDateFormat(r.end_date) ||
      !isValidRange(r)
    ) {
      setState({ status: 'error', message: 'Invalid date range' });
      return;
    }

    setState({ status: 'loading' });

    try {
      const records = await portalApi.getAttendance(pid, r);
      const sorted = sortAttendanceByDateDesc(records);

      if (sorted.length === 0) {
        setState({ status: 'empty' });
      } else {
        setState({ status: 'success', data: sorted });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Attendance history could not be retrieved';
      setState({ status: 'error', message });
    }
  }, []);

  useEffect(() => {
    // Don't fetch if inputs are not ready
    if (!personId || !range) {
      setState({ status: 'loading' });
      return;
    }

    fetchAttendance();
  }, [personId, range, fetchAttendance]);

  const retry = useCallback(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  return { state, retry };
}
