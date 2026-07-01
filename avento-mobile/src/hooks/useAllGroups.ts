/**
 * useAllGroups — hook that fetches all organization groups for Admin users
 * via `adminApi.getGroups()` (GET /api/groups).
 *
 * For Teacher role, pass `{ enabled: false }` to prevent fetching.
 * For Admin/SuperAdmin roles, this returns all groups in the organization.
 *
 * Validates: Requirements 6.1, 6.2
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { adminApi } from '@/api/admin';
import type { Group } from '@/types/models';

/** React Query key for all organization groups (admin). */
export const ALL_GROUPS_QUERY_KEY = ['admin', 'groups'] as const;

/**
 * Fetch all organization groups for Admin users.
 *
 * Returns a React Query result with all groups. The query can be disabled
 * via the `enabled` option (e.g., when the current user is a Teacher).
 */
export function useAllGroups(options?: {
  enabled?: boolean;
}): UseQueryResult<Group[], Error> {
  return useQuery({
    queryKey: ALL_GROUPS_QUERY_KEY,
    queryFn: () => adminApi.getGroups(),
    enabled: options?.enabled ?? true,
  });
}

export default useAllGroups;
