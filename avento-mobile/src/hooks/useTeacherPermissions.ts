/**
 * useTeacherPermissions — hook to check if the current Teacher user has
 * specific permissions.
 *
 * For Admin/SuperAdmin roles, all permissions are considered granted (full
 * access). For Teacher role, checks against the user's `permissions` array
 * in the auth store.
 *
 * Validates: Requirements 1.6, 4.4, 4.5
 */
import { useAuthStore } from '@/stores/auth';
import type { TeacherPermission } from '@/types/auth';

export interface TeacherPermissionsResult {
  /** Whether the current user has the specified permission */
  hasPermission: (permission: TeacherPermission) => boolean;
  /** Whether the current user has any of the specified permissions */
  hasAnyPermission: (permissions: TeacherPermission[]) => boolean;
  /** The current user's role */
  role: string | null;
  /** Whether the user is a Teacher (as opposed to Admin/SuperAdmin) */
  isTeacher: boolean;
  /** The current user's effective permissions array */
  permissions: TeacherPermission[];
}

/**
 * Hook that provides permission-checking utilities for the current user.
 *
 * Admin and SuperAdmin roles always pass all permission checks (they have
 * unrestricted access). Teacher users are checked against their granted
 * permissions array.
 */
export function useTeacherPermissions(): TeacherPermissionsResult {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? null;
  const isTeacher = role === 'Teacher';
  const permissions: TeacherPermission[] = user?.permissions ?? [];

  const hasPermission = (permission: TeacherPermission): boolean => {
    // Admin and SuperAdmin have all permissions
    if (role === 'Admin' || role === 'SuperAdmin') return true;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: TeacherPermission[]): boolean => {
    // Admin and SuperAdmin have all permissions
    if (role === 'Admin' || role === 'SuperAdmin') return true;
    return perms.some((p) => permissions.includes(p));
  };

  return {
    hasPermission,
    hasAnyPermission,
    role,
    isTeacher,
    permissions,
  };
}

export default useTeacherPermissions;
