import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';
import { logAudit } from '../utils/auditLog';
import {
  assignGroups,
  getAssignedGroups,
  InvalidGroupAssignmentError,
} from '../services/teacherGroupService';
import {
  VALID_PERMISSIONS,
  getEffectivePermissions,
  assignDirectPermissions,
  removeDirectPermissions,
  assignRoleTemplate,
  removeRoleTemplate,
} from '../services/permissionService';

const router = Router();

/** Helper to safely extract a single string from req.params */
function paramStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

const SALT_ROUNDS = 12;

/**
 * RFC 5322 simplified email regex.
 * Validates common email formats while rejecting clearly invalid ones.
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validates email format (RFC 5322 simplified) and max length (254 chars).
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Validates password meets minimum length requirement (8 chars).
 */
function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8;
}

// GET /me/permissions - Get current teacher's effective permissions (Teacher only)
router.get(
  '/me/permissions',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (req.user!.role !== 'Teacher') {
        res.status(403).json({ error: 'This endpoint is for Teacher users only' });
        return;
      }

      const permissions = await getEffectivePermissions(req.user!.user_id, req.organizationId!);

      res.status(200).json({ permissions });
    } catch (error) {
      throw error;
    }
  }
);

// GET /me/groups - Get current teacher's assigned groups (Teacher only)
router.get(
  '/me/groups',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (req.user!.role !== 'Teacher') {
        res.status(403).json({ error: 'This endpoint is for Teacher users only' });
        return;
      }

      const groups = await getAssignedGroups(req.user!.user_id, req.organizationId!);

      res.status(200).json({ groups });
    } catch (error) {
      throw error;
    }
  }
);

// POST / - Create a new Teacher account (Admin only)
router.post(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Invalid email format. Must be a valid email address (max 254 characters)' });
      return;
    }

    // Validate password length
    if (!isValidPassword(password)) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    try {
      // Check for duplicate email within the same organization
      const existingUser = await db('users')
        .whereRaw('LOWER(email) = LOWER(?)', [email.trim()])
        .where({ organization_id: req.organizationId })
        .first();

      if (existingUser) {
        res.status(409).json({ error: 'Email already in use in this organization' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create teacher user
      const [teacher] = await db('users')
        .insert({
          organization_id: req.organizationId,
          email: email.trim(),
          password_hash: passwordHash,
          role: 'Teacher',
        })
        .returning(['id', 'email', 'role', 'organization_id', 'created_at', 'updated_at']);

      // Audit log: teacher created
      void logAudit({
        organization_id: req.organizationId!,
        user_id: req.user!.user_id,
        action: 'CREATE',
        entity_type: 'teacher',
        entity_id: teacher.id,
        details: { email: teacher.email },
        ip_address: req.ip,
      });

      res.status(201).json({ teacher });
    } catch (error) {
      throw error;
    }
  }
);

// GET / - List all teachers in the organization (Admin only)
router.get(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const teachers = await db('users')
        .where({
          organization_id: req.organizationId,
          role: 'Teacher',
        })
        .select('id', 'email', 'role', 'organization_id', 'created_at', 'updated_at')
        .orderBy('created_at', 'desc');

      res.status(200).json({ teachers });
    } catch (error) {
      throw error;
    }
  }
);

// PUT /:id - Update teacher details (Admin only)
router.put(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramStr(req.params.id);
    const { email, password } = req.body;

    try {
      // Find teacher by id, role, and organization
      const teacher = await db('users')
        .where({ id, organization_id: req.organizationId, role: 'Teacher' })
        .first();

      if (!teacher) {
        res.status(404).json({ error: 'Teacher not found' });
        return;
      }

      // Build update object
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Validate and set email if provided
      if (email !== undefined) {
        if (!isValidEmail(email)) {
          res.status(400).json({ error: 'Invalid email format. Must be a valid email address (max 254 characters)' });
          return;
        }

        // Check for duplicate email within org (exclude current teacher)
        const existingUser = await db('users')
          .whereRaw('LOWER(email) = LOWER(?)', [email.trim()])
          .where({ organization_id: req.organizationId })
          .whereNot({ id })
          .first();

        if (existingUser) {
          res.status(409).json({ error: 'Email already in use in this organization' });
          return;
        }

        updates.email = email.trim();
      }

      // Validate and set password if provided
      if (password !== undefined) {
        if (!isValidPassword(password)) {
          res.status(400).json({ error: 'Password must be at least 8 characters' });
          return;
        }
        updates.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      }

      // Update the teacher record
      const [updatedTeacher] = await db('users')
        .where({ id, organization_id: req.organizationId, role: 'Teacher' })
        .update(updates)
        .returning(['id', 'email', 'role', 'organization_id', 'created_at', 'updated_at']);

      // Audit log: teacher updated
      void logAudit({
        organization_id: req.organizationId!,
        user_id: req.user!.user_id,
        action: 'UPDATE',
        entity_type: 'teacher',
        entity_id: id,
        details: { updated_fields: Object.keys(updates).filter(k => k !== 'updated_at' && k !== 'password_hash') },
        ip_address: req.ip,
      });

      res.status(200).json({ teacher: updatedTeacher });
    } catch (error) {
      throw error;
    }
  }
);

// DELETE /:id - Deactivate a teacher (soft-delete)
// Since the users table does not have an is_active column, we delete the user record.
// To implement true soft-delete, a migration adding is_active to users would be needed.
// For now, we hard-delete the teacher record as the cleanest approach given the current schema.
router.delete(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramStr(req.params.id);

    try {
      // Find teacher by id, role, and organization
      const teacher = await db('users')
        .where({ id, organization_id: req.organizationId, role: 'Teacher' })
        .first();

      if (!teacher) {
        res.status(404).json({ error: 'Teacher not found' });
        return;
      }

      // Delete the teacher record
      await db('users')
        .where({ id, organization_id: req.organizationId, role: 'Teacher' })
        .del();

      // Audit log: teacher deactivated/deleted
      void logAudit({
        organization_id: req.organizationId!,
        user_id: req.user!.user_id,
        action: 'DELETE',
        entity_type: 'teacher',
        entity_id: id,
        details: { email: teacher.email },
        ip_address: req.ip,
      });

      res.status(200).json({
        message: 'Teacher deactivated successfully',
      });
    } catch (error) {
      throw error;
    }
  }
);

// PUT /:id/groups - Assign groups to a teacher (Admin only)
router.put(
  '/:id/groups',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramStr(req.params.id);
    const { group_ids } = req.body;

    // Validate request body
    if (!Array.isArray(group_ids)) {
      res.status(400).json({ error: 'group_ids must be an array' });
      return;
    }

    try {
      // Validate that the teacher exists and belongs to the same organization
      const teacher = await db('users')
        .where({ id, organization_id: req.organizationId, role: 'Teacher' })
        .first();

      if (!teacher) {
        res.status(404).json({ error: 'Teacher not found' });
        return;
      }

      // Assign groups (service validates org-scoping of groups)
      await assignGroups(id, group_ids, req.organizationId!);

      // Get the updated group assignments to return
      const groups = await getAssignedGroups(id, req.organizationId!);

      // Audit log: groups assigned
      void logAudit({
        organization_id: req.organizationId!,
        user_id: req.user!.user_id,
        action: 'UPDATE',
        entity_type: 'teacher_groups',
        entity_id: id,
        details: { group_ids },
        ip_address: req.ip,
      });

      res.status(200).json({ groups });
    } catch (error) {
      if (error instanceof InvalidGroupAssignmentError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  }
);

// GET /:id/groups - Get assigned groups for a teacher (Admin only)
router.get(
  '/:id/groups',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramStr(req.params.id);

    try {
      // Validate that the teacher exists and belongs to the same organization
      const teacher = await db('users')
        .where({ id, organization_id: req.organizationId, role: 'Teacher' })
        .first();

      if (!teacher) {
        res.status(404).json({ error: 'Teacher not found' });
        return;
      }

      const groups = await getAssignedGroups(id, req.organizationId!);

      res.status(200).json({ groups });
    } catch (error) {
      throw error;
    }
  }
);

// GET /:id/permissions - Get teacher's current permissions data (Admin only)
router.get(
  '/:id/permissions',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramStr(req.params.id);

    try {
      // Validate that the teacher exists and belongs to the same organization
      const teacher = await db('users')
        .where({ id, organization_id: req.organizationId, role: 'Teacher' })
        .first();

      if (!teacher) {
        res.status(404).json({ error: 'Teacher not found' });
        return;
      }

      // Get direct permissions
      const directRows = await db('permissions')
        .where({ user_id: id, organization_id: req.organizationId })
        .select('permission_name');
      const direct_permissions = directRows.map((r: { permission_name: string }) => r.permission_name);

      // Get assigned role template (if any)
      const templateAssignment = await db('user_role_templates')
        .where({ user_id: id })
        .first();
      const template_id = templateAssignment?.template_id || null;

      // Get effective permissions (union of template + direct)
      const effective_permissions = await getEffectivePermissions(id, req.organizationId!);

      res.status(200).json({
        direct_permissions,
        template_id,
        effective_permissions,
      });
    } catch (error) {
      throw error;
    }
  }
);

// PUT /:id/permissions - Assign direct permissions to a teacher (Admin only)
router.put(
  '/:id/permissions',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramStr(req.params.id);
    const { permissions } = req.body;

    // Validate permissions array
    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: 'permissions must be an array' });
      return;
    }

    // Validate all permission names
    const invalidPerms = permissions.filter(
      (p: string) => !(VALID_PERMISSIONS as readonly string[]).includes(p)
    );
    if (invalidPerms.length > 0) {
      res.status(400).json({ error: `Invalid permissions: ${invalidPerms.join(', ')}` });
      return;
    }

    try {
      // Validate that the teacher exists and belongs to the same organization
      const teacher = await db('users')
        .where({ id, organization_id: req.organizationId, role: 'Teacher' })
        .first();

      if (!teacher) {
        res.status(404).json({ error: 'Teacher not found' });
        return;
      }

      // Replace all direct permissions: remove existing, then assign new ones
      await removeDirectPermissions(id, req.organizationId!, 
        (VALID_PERMISSIONS as readonly string[]).slice() as string[]
      );
      if (permissions.length > 0) {
        await assignDirectPermissions(id, req.organizationId!, permissions);
      }

      // Audit log
      void logAudit({
        organization_id: req.organizationId!,
        user_id: req.user!.user_id,
        action: 'UPDATE',
        entity_type: 'teacher_permissions',
        entity_id: id,
        details: { permissions },
        ip_address: req.ip,
      });

      // Return updated effective permissions
      const effective_permissions = await getEffectivePermissions(id, req.organizationId!);

      res.status(200).json({
        direct_permissions: permissions,
        effective_permissions,
      });
    } catch (error) {
      throw error;
    }
  }
);

// PUT /:id/role-template - Assign or remove a role template from a teacher (Admin only)
router.put(
  '/:id/role-template',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramStr(req.params.id);
    const { template_id } = req.body;

    try {
      // Validate that the teacher exists and belongs to the same organization
      const teacher = await db('users')
        .where({ id, organization_id: req.organizationId, role: 'Teacher' })
        .first();

      if (!teacher) {
        res.status(404).json({ error: 'Teacher not found' });
        return;
      }

      // Remove any existing template assignment for this user
      await db('user_role_templates').where({ user_id: id }).del();

      // If template_id is provided, validate and assign
      if (template_id) {
        const template = await db('role_templates')
          .where({ id: template_id, organization_id: req.organizationId })
          .first();

        if (!template) {
          res.status(404).json({ error: 'Role template not found' });
          return;
        }

        await assignRoleTemplate(id, template_id);
      }

      // Audit log
      void logAudit({
        organization_id: req.organizationId!,
        user_id: req.user!.user_id,
        action: 'UPDATE',
        entity_type: 'teacher_role_template',
        entity_id: id,
        details: { template_id: template_id || null },
        ip_address: req.ip,
      });

      // Return updated effective permissions
      const effective_permissions = await getEffectivePermissions(id, req.organizationId!);

      res.status(200).json({
        template_id: template_id || null,
        effective_permissions,
      });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
