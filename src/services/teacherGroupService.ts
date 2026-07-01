import db from '../config/database';

/**
 * Represents a group record returned by getAssignedGroups.
 */
export interface AssignedGroup {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  assigned_at: string;
}

/**
 * Assigns a teacher to one or more groups within their organization.
 * Validates that all group_ids belong to the same organization as the teacher.
 * Replaces existing assignments (delete all + insert new) in a transaction.
 */
export async function assignGroups(
  teacherId: string,
  groupIds: string[],
  organizationId: string
): Promise<void> {
  if (groupIds.length === 0) {
    // Empty array means remove all group assignments
    await db('teacher_groups').where({ teacher_id: teacherId }).del();
    return;
  }

  // Validate that all provided group_ids belong to the same organization
  const validGroups = await db('groups')
    .whereIn('id', groupIds)
    .where({ organization_id: organizationId })
    .select('id');

  const validGroupIds = validGroups.map((g) => g.id);
  const invalidGroupIds = groupIds.filter((id) => !validGroupIds.includes(id));

  if (invalidGroupIds.length > 0) {
    throw new InvalidGroupAssignmentError(
      `Groups not found or not in this organization: ${invalidGroupIds.join(', ')}`
    );
  }

  // Replace existing assignments in a transaction
  await db.transaction(async (trx) => {
    // Delete all existing group assignments for this teacher
    await trx('teacher_groups').where({ teacher_id: teacherId }).del();

    // Insert new assignments
    const rows = groupIds.map((groupId) => ({
      teacher_id: teacherId,
      group_id: groupId,
    }));

    await trx('teacher_groups').insert(rows);
  });
}

/**
 * Removes a specific teacher-group assignment.
 */
export async function removeGroup(
  teacherId: string,
  groupId: string
): Promise<void> {
  await db('teacher_groups')
    .where({ teacher_id: teacherId, group_id: groupId })
    .del();
}

/**
 * Gets all groups assigned to a teacher within their organization.
 * Joins teacher_groups with groups to return full group details.
 */
export async function getAssignedGroups(
  teacherId: string,
  organizationId: string
): Promise<AssignedGroup[]> {
  const groups = await db('teacher_groups')
    .join('groups', 'teacher_groups.group_id', 'groups.id')
    .where({
      'teacher_groups.teacher_id': teacherId,
      'groups.organization_id': organizationId,
    })
    .select(
      'groups.id',
      'groups.name',
      'groups.description',
      'groups.organization_id',
      'teacher_groups.assigned_at'
    );

  return groups;
}

/**
 * Checks if a teacher is assigned to a specific group.
 * Simple existence check on the teacher_groups table.
 */
export async function isAssignedToGroup(
  teacherId: string,
  groupId: string
): Promise<boolean> {
  const row = await db('teacher_groups')
    .where({ teacher_id: teacherId, group_id: groupId })
    .first();

  return !!row;
}

/**
 * Custom error for invalid group assignment attempts.
 */
export class InvalidGroupAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidGroupAssignmentError';
  }
}
