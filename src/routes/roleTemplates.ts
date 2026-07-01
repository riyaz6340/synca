import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';
import { VALID_PERMISSIONS } from '../services/permissionService';
import { logAudit } from '../utils/auditLog';

const router = Router();

/**
 * Validates that permission names are all valid.
 * Returns an array of invalid permission names (empty if all valid).
 */
function getInvalidPermissions(permissions: string[]): string[] {
  return permissions.filter(
    (p) => !(VALID_PERMISSIONS as readonly string[]).includes(p)
  );
}

// POST / - Create a new Role Template (Admin only)
router.post(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { name, permissions } = req.body;

    // Validate name
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      res.status(400).json({ error: 'Name must be between 1 and 100 characters' });
      return;
    }

    // Validate permissions array
    if (!Array.isArray(permissions) || permissions.length === 0) {
      res.status(400).json({ error: 'Permissions must be a non-empty array' });
      return;
    }

    const invalidPerms = getInvalidPermissions(permissions);
    if (invalidPerms.length > 0) {
      res.status(400).json({
        error: `Invalid permissions: ${invalidPerms.join(', ')}`,
      });
      return;
    }

    try {
      // Check for duplicate name within organization
      const existing = await db('role_templates')
        .whereRaw('LOWER(name) = LOWER(?)', [trimmedName])
        .where({ organization_id: req.organizationId })
        .first();

      if (existing) {
        res.status(409).json({ error: 'Role template name already exists' });
        return;
      }

      // Create role template and permissions in a transaction
      const result = await db.transaction(async (trx) => {
        const [template] = await trx('role_templates')
          .insert({
            name: trimmedName,
            organization_id: req.organizationId,
          })
          .returning(['id', 'name', 'organization_id', 'created_at', 'updated_at']);

        // Insert template permissions
        const permissionRows = permissions.map((permissionName: string) => ({
          template_id: template.id,
          permission_name: permissionName,
        }));

        await trx('template_permissions').insert(permissionRows);

        return template;
      });

      // Audit log
      void logAudit({
        organization_id: req.organizationId!,
        user_id: req.user!.user_id,
        action: 'CREATE',
        entity_type: 'role_template',
        entity_id: result.id,
        details: { name: trimmedName, permissions },
        ip_address: req.ip,
      });

      res.status(201).json({
        template: {
          ...result,
          permissions,
        },
      });
    } catch (error) {
      throw error;
    }
  }
);

// GET / - List all role templates for the organization (Admin only)
router.get(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const templates = await db('role_templates')
        .where({ organization_id: req.organizationId })
        .select('id', 'name', 'organization_id', 'created_at', 'updated_at')
        .orderBy('created_at', 'desc');

      // Fetch permissions for each template
      const templateIds = templates.map((t) => t.id);
      const permissionRows = await db('template_permissions')
        .whereIn('template_id', templateIds)
        .select('template_id', 'permission_name');

      // Group permissions by template_id
      const permissionsByTemplate: Record<string, string[]> = {};
      for (const row of permissionRows) {
        if (!permissionsByTemplate[row.template_id]) {
          permissionsByTemplate[row.template_id] = [];
        }
        permissionsByTemplate[row.template_id].push(row.permission_name);
      }

      // Attach permissions to each template
      const templatesWithPermissions = templates.map((t) => ({
        ...t,
        permissions: permissionsByTemplate[t.id] || [],
      }));

      res.status(200).json({ templates: templatesWithPermissions });
    } catch (error) {
      throw error;
    }
  }
);

// PUT /:id - Update a role template (Admin only)
router.put(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { name, permissions } = req.body;

    // At least one field must be provided
    if (name === undefined && permissions === undefined) {
      res.status(400).json({ error: 'At least name or permissions must be provided' });
      return;
    }

    // Validate name if provided
    let trimmedName: string | undefined;
    if (name !== undefined) {
      if (typeof name !== 'string') {
        res.status(400).json({ error: 'Name must be a string' });
        return;
      }
      trimmedName = name.trim();
      if (trimmedName.length < 1 || trimmedName.length > 100) {
        res.status(400).json({ error: 'Name must be between 1 and 100 characters' });
        return;
      }
    }

    // Validate permissions if provided
    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.length === 0) {
        res.status(400).json({ error: 'Permissions must be a non-empty array' });
        return;
      }

      const invalidPerms = getInvalidPermissions(permissions);
      if (invalidPerms.length > 0) {
        res.status(400).json({
          error: `Invalid permissions: ${invalidPerms.join(', ')}`,
        });
        return;
      }
    }

    try {
      // Find template by id and organization
      const template = await db('role_templates')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!template) {
        res.status(404).json({ error: 'Role template not found' });
        return;
      }

      // Check for duplicate name within org (exclude current template)
      if (trimmedName !== undefined) {
        const existing = await db('role_templates')
          .whereRaw('LOWER(name) = LOWER(?)', [trimmedName])
          .where({ organization_id: req.organizationId })
          .whereNot({ id })
          .first();

        if (existing) {
          res.status(409).json({ error: 'Role template name already exists' });
          return;
        }
      }

      // Update in a transaction
      const result = await db.transaction(async (trx) => {
        // Update template fields
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (trimmedName !== undefined) {
          updates.name = trimmedName;
        }

        const [updatedTemplate] = await trx('role_templates')
          .where({ id, organization_id: req.organizationId })
          .update(updates)
          .returning(['id', 'name', 'organization_id', 'created_at', 'updated_at']);

        // If permissions are provided, replace all template_permissions
        if (permissions !== undefined) {
          await trx('template_permissions').where({ template_id: id }).del();
          const permissionRows = permissions.map((permissionName: string) => ({
            template_id: id,
            permission_name: permissionName,
          }));
          await trx('template_permissions').insert(permissionRows);
        }

        return updatedTemplate;
      });

      // Fetch current permissions for response
      const currentPermissions = await db('template_permissions')
        .where({ template_id: id })
        .select('permission_name');

      // Audit log
      void logAudit({
        organization_id: req.organizationId!,
        user_id: req.user!.user_id,
        action: 'UPDATE',
        entity_type: 'role_template',
        entity_id: id,
        details: {
          ...(trimmedName !== undefined && { name: trimmedName }),
          ...(permissions !== undefined && { permissions }),
        },
        ip_address: req.ip,
      });

      res.status(200).json({
        template: {
          ...result,
          permissions: currentPermissions.map((r) => r.permission_name),
        },
      });
    } catch (error) {
      throw error;
    }
  }
);

// DELETE /:id - Delete a role template (Admin only, only if not assigned)
router.delete(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    try {
      // Find template by id and organization
      const template = await db('role_templates')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!template) {
        res.status(404).json({ error: 'Role template not found' });
        return;
      }

      // Check if any teachers are assigned to this template
      const assignmentCount = await db('user_role_templates')
        .where({ template_id: id })
        .count('* as count')
        .first();

      const count = Number(assignmentCount?.count || 0);
      if (count > 0) {
        res.status(409).json({
          error: `Cannot delete: template is assigned to ${count} teacher(s)`,
        });
        return;
      }

      // Delete template (template_permissions cascade on delete)
      await db('role_templates')
        .where({ id, organization_id: req.organizationId })
        .del();

      // Audit log
      void logAudit({
        organization_id: req.organizationId!,
        user_id: req.user!.user_id,
        action: 'DELETE',
        entity_type: 'role_template',
        entity_id: id,
        details: { name: template.name },
        ip_address: req.ip,
      });

      res.status(200).json({ message: 'Role template deleted successfully' });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
