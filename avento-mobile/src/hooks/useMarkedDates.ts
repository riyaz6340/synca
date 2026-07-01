/**
 * useMarkedDates — React Query hook that fetches marked attendance dates
 * for multiple groups in parallel and aggregates results.
 *
 * For each group ID, makes a parallel API call to
 * `GET /api/attendance/marked-dates?group_id=X&year=Y&month=M`
 * and returns a map of groupId → date strings ('YYYY-MM-DD').
 *
 * Validates: Requirements 2.5, 5.2, 6.1
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import type { MarkedDatesByGroup } from '@/utils/calendarUtils';

export type { MarkedDatesByGroup } from '@/utils/calendarUtils';

export interface MarkedDatesParams {
  groupIds: string[];
  year: number;
  month: number;
  enabled?: boolean;
}

/** Base query key for marked dates queries. */
export const MARKED_DATES_QUERY_KEY = ['attendance', 'marked-dates'] as const;

/**
 * Fetch marked dates for each group in the given month, returning a map of
 * groupId → marked date strings.
 *
 * Makes parallel API calls via Promise.all for all provided group IDs.
 * The query is only enabled when `enabled` is true AND `groupIds.length > 0`.
 */
export function useMarkedDates({
  groupIds,
  year,
  month,
  enabled = true,
}: MarkedDatesParams): UseQueryResult<MarkedDatesByGroup, Error> {
  return useQuery({
    queryKey: [...MARKED_DATES_QUERY_KEY, { groupIds, year, month }],
    queryFn: async (): Promise<MarkedDatesByGroup> => {
      const results = await Promise.all(
        groupIds.map(async (groupId) => {
          const res = await apiClient.get<{ marked_dates: string[] }>(
            '/api/attendance/marked-dates',
            { params: { group_id: groupId, year, month } },
          );
          return { groupId, dates: res.data.marked_dates ?? [] };
        }),
      );

      const map: MarkedDatesByGroup = {};
      for (const { groupId, dates } of results) {
        map[groupId] = dates;
      }
      return map;
    },
    enabled: enabled && groupIds.length > 0,
  });
}

export default useMarkedDates;
