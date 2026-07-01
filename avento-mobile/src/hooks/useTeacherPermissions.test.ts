/**
 * Unit tests for useTeacherPermissions hook.
 *
 * We test the underlying logic by mocking the auth store to return
 * different user roles and permission sets.
 *
 * Validates: Requirements 1.6, 4.4, 4.5
 */
import { renderHook } from '@testing-library/react-native';

import { useTeacherPermissions } from './useTeacherPermissions';

// Mock the auth store
const mockUser = jest.fn();
jest.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: mockUser() }),
}));

describe('useTeacherPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns isTeacher=true and checks permissions for Teacher role', () => {
    mockUser.mockReturnValue({
      id: 'teacher-1',
      role: 'Teacher',
      organization_id: 'org-1',
      email: 'teacher@test.com',
      permissions: ['mark_attendance', 'view_attendance_reports'],
    });

    const { result } = renderHook(() => useTeacherPermissions());

    expect(result.current.isTeacher).toBe(true);
    expect(result.current.role).toBe('Teacher');
    expect(result.current.hasPermission('mark_attendance')).toBe(true);
    expect(result.current.hasPermission('manage_students')).toBe(false);
    expect(
      result.current.hasAnyPermission(['mark_attendance', 'manage_students']),
    ).toBe(true);
    expect(
      result.current.hasAnyPermission(['manage_students', 'manage_groups']),
    ).toBe(false);
  });

  it('grants all permissions for Admin role', () => {
    mockUser.mockReturnValue({
      id: 'admin-1',
      role: 'Admin',
      organization_id: 'org-1',
      email: 'admin@test.com',
      permissions: [],
    });

    const { result } = renderHook(() => useTeacherPermissions());

    expect(result.current.isTeacher).toBe(false);
    expect(result.current.role).toBe('Admin');
    expect(result.current.hasPermission('mark_attendance')).toBe(true);
    expect(result.current.hasPermission('manage_students')).toBe(true);
    expect(
      result.current.hasAnyPermission(['mark_attendance', 'manage_groups']),
    ).toBe(true);
  });

  it('grants all permissions for SuperAdmin role', () => {
    mockUser.mockReturnValue({
      id: 'sa-1',
      role: 'SuperAdmin',
      organization_id: 'org-1',
      email: 'super@test.com',
    });

    const { result } = renderHook(() => useTeacherPermissions());

    expect(result.current.isTeacher).toBe(false);
    expect(result.current.hasPermission('manage_holidays')).toBe(true);
  });

  it('returns empty permissions when user has no permissions array', () => {
    mockUser.mockReturnValue({
      id: 'teacher-2',
      role: 'Teacher',
      organization_id: 'org-1',
      email: 'teacher2@test.com',
    });

    const { result } = renderHook(() => useTeacherPermissions());

    expect(result.current.isTeacher).toBe(true);
    expect(result.current.permissions).toEqual([]);
    expect(result.current.hasPermission('mark_attendance')).toBe(false);
  });

  it('handles null user gracefully', () => {
    mockUser.mockReturnValue(null);

    const { result } = renderHook(() => useTeacherPermissions());

    expect(result.current.isTeacher).toBe(false);
    expect(result.current.role).toBeNull();
    expect(result.current.permissions).toEqual([]);
    expect(result.current.hasPermission('mark_attendance')).toBe(false);
  });
});
