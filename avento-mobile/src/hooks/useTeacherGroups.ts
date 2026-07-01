/**
 * useTeacherGroups — hook that fetches the groups assigned to the current
 * Teacher user via `GET /api/teachers/:id/groups`.
 *
 * For Admin/SuperAdmin roles, this hook is not used (they see all org groups).
 * For Teacher role, it returns only the groups assigned to them.
 *
 * Validates: Requirements 4.4, 4.5
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import type { Group } from '@/types/models';

/** React Query key for the teacher's assigned groups. */
export const TEACHER_GROUPS_QUERY_KEY = ['teacher', 'groups'] as const;

/**
 * Fetch the assigned groups for the current Teacher user.
 *
 * Returns a React Query result with the assigned groups. The query is
 * only enabled when the current user has role "Teacher" and a valid user id.
 */
export function useTeacherGroups(): UseQueryResult<Group[], Error> {
  const user = useAuthStore((s) => s.user);
  const isTeacher = user?.role === 'Teacher';
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: [...TEACHER_GROUPS_QUERY_KEY, userId],
    queryFn: async (): Promise<Group[]> => {
      const res = await apiClient.get<{ groups: Group[] }>(
        `/api/teachers/${userId}/groups`,
      );
      return res.data.groups;
    },
    enabled: isTeacher && !!userId,
  });
}

export default useTeacherGroups;
