/**
 * withPermissionGate — Higher-Order Component that wraps a screen with a
 * permission check. If the Teacher lacks the required permission, it renders
 * a PermissionDeniedScreen instead of the wrapped component.
 *
 * For Admin/SuperAdmin users, the gate is always open (full access).
 *
 * Usage:
 *   export default withPermissionGate(MyScreen, 'mark_attendance');
 *
 * Validates: Requirements 1.6, 4.4, 4.5
 */
import React from 'react';

import { useTeacherPermissions } from '@/hooks/useTeacherPermissions';
import type { TeacherPermission } from '@/types/auth';

import { PermissionDeniedScreen } from './PermissionDeniedScreen';

/**
 * Wrap a screen component with a permission gate. If the current user is a
 * Teacher and lacks the required permission, PermissionDeniedScreen is shown.
 *
 * @param WrappedComponent The screen component to protect
 * @param requiredPermission The permission needed to view this screen
 */
export function withPermissionGate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission: TeacherPermission,
): React.FC<P> {
  const GatedScreen: React.FC<P> = (props) => {
    const { hasPermission, isTeacher } = useTeacherPermissions();

    if (isTeacher && !hasPermission(requiredPermission)) {
      return <PermissionDeniedScreen permission={requiredPermission} />;
    }

    return <WrappedComponent {...props} />;
  };

  GatedScreen.displayName = `PermissionGated(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return GatedScreen;
}

export default withPermissionGate;
