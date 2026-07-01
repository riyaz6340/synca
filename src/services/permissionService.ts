import db from '../config/database';

/**
 * The set of all valid granular permissions that can be assigned to users.
 */
export const VALID_PERMISSIONS = [
  'mark_attendance',
  'view_attendance_reports',
  'create_announcements',
  'publish_announcements',
  'manage_holidays',
  'approve_leave_requests',
  'view_leave_requests',
  'manage_students',
  'manage_groups',
] as const;

export type Permission = (typeof VALID_PERMISSIONS)[number];

/**
 * Computes the effective permissions for a user within an organization.
 * Effective permissions = union of direct permissions + all template permissions.
 * Computed at query time to ensure immediate propagation when templates change.
 */
export async function getEffectivePermissions(
  userId: string,
  organizationId: string
): Promise<string[]> {
  // Query direct permissions
  const directRows = await db('permissions')
    .where({ user_id: userId, organization_id: organizationId })
    .select('permission_name');

  // Query template permissions via user_role_templates join
  const templateRows = await db('user_role_templates')
    .join(
      'template_permissions',
      'user_role_templates.template_id',
      'template_permissions.template_id'
    )
    .where('user_role_templates.user_id', userId)
    .select('template_permissions.permission_name');

  // Compute union (deduplicated)
  const permissionSet = new Set<string>();
  for (const row of directRows) {
    permissionSet.add(row.permission_name);
  }
  for (const row of templateRows) {
    permissionSet.add(row.permission_name);
  }

  return Array.from(permissionSet);
}

/**
 * Checks if a user has a specific permission within an organization.
 * Returns true if the permission is found in the user's effective permissions.
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: string
): Promise<boolean> {
  const effectivePermissions = await getEffectivePermissions(userId, organizationId);
  return effectivePermissions.includes(permission);
}

/**
 * Assigns one or more direct permissions to a user within an organization.
 * Uses INSERT ... ON CONFLICT DO NOTHING to handle duplicates gracefully.
 */
export async function assignDirectPermissions(
  userId: string,
  organizationId: string,
  permissions: string[]
): Promise<void> {
  if (permissions.length === 0) return;

  const rows = permissions.map((permissionName) => ({
    user_id: userId,
    organization_id: organizationId,
    permission_name: permissionName,
  }));

  await db('permissions')
    .insert(rows)
    .onConflict(['user_id', 'permission_name'])
    .ignore();
}

/**
 * Removes one or more direct permissions from a user within an organization.
 */
export async function removeDirectPermissions(
  userId: string,
  organizationId: string,
  permissions: string[]
): Promise<void> {
  if (permissions.length === 0) return;

  await db('permissions')
    .where({ user_id: userId, organization_id: organizationId })
    .whereIn('permission_name', permissions)
    .del();
}

/**
 * Assigns a role template to a user.
 * Uses INSERT ... ON CONFLICT DO NOTHING to handle duplicate assignments gracefully.
 */
export async function assignRoleTemplate(
  userId: string,
  templateId: string
): Promise<void> {
  await db('user_role_templates')
    .insert({
      user_id: userId,
      template_id: templateId,
    })
    .onConflict(['user_id', 'template_id'])
    .ignore();
}

/**
 * Removes a role template assignment from a user.
 */
export async function removeRoleTemplate(
  userId: string,
  templateId: string
): Promise<void> {
  await db('user_role_templates')
    .where({ user_id: userId, template_id: templateId })
    .del();
}
