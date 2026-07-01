import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';

const router = Router();

// POST / - Create a new Group (Admin only)
router.post(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { name, description } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    try {
      const [group] = await db('groups')
        .insert({
          organization_id: req.organizationId,
          name: name.trim(),
          description: description || null,
        })
        .returning('*');

      res.status(201).json({ group });
    } catch (error) {
      throw error;
    }
  }
);

// GET / - List all Groups with member counts (Admin only)
router.get(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const groups = await db('groups')
        .select(
          'groups.id',
          'groups.organization_id',
          'groups.name',
          'groups.description',
          'groups.created_at',
          'groups.updated_at',
          db.raw('COUNT(person_groups.person_id)::int as member_count')
        )
        .leftJoin('person_groups', 'groups.id', 'person_groups.group_id')
        .where('groups.organization_id', req.organizationId)
        .groupBy('groups.id')
        .orderBy('groups.name', 'asc');

      res.status(200).json({ groups });
    } catch (error) {
      throw error;
    }
  }
);

// GET /:id - Get Group details with member list (Admin only)
router.get(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const group = await db('groups')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      const members = await db('person_groups')
        .join('persons', 'person_groups.person_id', 'persons.id')
        .where('person_groups.group_id', id)
        .select(
          'persons.id',
          'persons.organization_id',
          'persons.name',
          'persons.contact_info',
          'persons.metadata',
          'persons.is_active',
          'persons.created_at',
          'persons.updated_at',
          'person_groups.assigned_at'
        );

      res.status(200).json({ group: { ...group, members } });
    } catch (error) {
      throw error;
    }
  }
);

// PUT /:id - Update Group details (Admin only)
router.put(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, description } = req.body;

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Name must be a non-empty string' });
        return;
      }
    }

    try {
      // Find group by id and organization_id (tenant isolation)
      const group = await db('groups')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      // Build update object with only provided fields
      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (name !== undefined) {
        updates.name = name.trim();
      }
      if (description !== undefined) {
        updates.description = description;
      }

      const [updatedGroup] = await db('groups')
        .where({ id, organization_id: req.organizationId })
        .update(updates)
        .returning('*');

      res.status(200).json({ group: updatedGroup });
    } catch (error) {
      throw error;
    }
  }
);

// POST /:id/members - Add Persons to a Group (Admin only)
router.post(
  '/:id/members',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { person_ids } = req.body;

    // Validate person_ids is a non-empty array
    if (!Array.isArray(person_ids) || person_ids.length === 0) {
      res.status(400).json({ error: 'person_ids must be a non-empty array' });
      return;
    }

    try {
      // Verify the group exists and belongs to the org
      const group = await db('groups')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      // Validate all person_ids belong to the same organization
      const validPersons = await db('persons')
        .whereIn('id', person_ids)
        .where('organization_id', req.organizationId)
        .select('id');
      const validPersonIds = validPersons.map((p: { id: string }) => p.id);
      const invalidPersonIds = person_ids.filter((id: string) => !validPersonIds.includes(id));
      if (invalidPersonIds.length > 0) {
        res.status(400).json({ error: 'Some person_ids do not belong to your organization', invalid_ids: invalidPersonIds });
        return;
      }

      // Check if any of these students are already in another class
      const alreadyInClass = await db('person_groups')
        .join('groups', 'person_groups.group_id', 'groups.id')
        .join('persons', 'person_groups.person_id', 'persons.id')
        .whereIn('person_groups.person_id', person_ids)
        .where('person_groups.group_id', '!=', id)
        .select('persons.name', 'groups.name as group_name', 'persons.id as person_id');

      if (alreadyInClass.length > 0) {
        const conflicts = alreadyInClass.map((c: { name: string; group_name: string }) => `${c.name} is already in ${c.group_name}`);
        res.status(400).json({
          error: 'Some students are already assigned to another class',
          conflicts,
        });
        return;
      }

      // Insert each person_id into person_groups, skipping duplicates
      const rows = person_ids.map((person_id: string) => ({
        person_id,
        group_id: id,
      }));

      const result = await db('person_groups')
        .insert(rows)
        .onConflict(['person_id', 'group_id'])
        .ignore();

      const added_count = (result as unknown as { rowCount?: number }).rowCount ?? person_ids.length;

      res.status(200).json({ message: 'Members added', added_count });
    } catch (error) {
      throw error;
    }
  }
);

// PUT /:id/members/:personId/roll-number - Assign/update roll number for a member (Admin only)
router.put(
  '/:id/members/:personId/roll-number',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id, personId } = req.params;
    const { roll_number } = req.body;

    // Validate roll_number: must be null (to clear) or integer between 1 and 9999
    if (roll_number !== null && roll_number !== undefined) {
      const num = Number(roll_number);
      if (!Number.isInteger(num) || num < 1 || num > 9999) {
        res.status(400).json({ error: 'Roll number must be between 1 and 9999' });
        return;
      }
    }

    try {
      // Verify the group exists and belongs to the admin's organization
      const group = await db('groups')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      // Verify the person is a member of this group
      const membership = await db('person_groups')
        .where({ person_id: personId, group_id: id })
        .first();

      if (!membership) {
        res.status(404).json({ error: 'Person is not a member of this group' });
        return;
      }

      const newRollNumber = roll_number === null || roll_number === undefined ? null : Number(roll_number);

      // Check for duplicates within the group (excluding current person)
      if (newRollNumber !== null) {
        const existing = await db('person_groups')
          .where({ group_id: id, roll_number: newRollNumber })
          .whereNot({ person_id: personId })
          .first();

        if (existing) {
          res.status(409).json({ error: `Roll number ${newRollNumber} is already assigned in this group` });
          return;
        }
      }

      // Update the roll_number
      await db('person_groups')
        .where({ person_id: personId, group_id: id })
        .update({ roll_number: newRollNumber });

      res.status(200).json({
        message: 'Roll number updated',
        person_id: personId,
        group_id: id,
        roll_number: newRollNumber,
      });
    } catch (error) {
      throw error;
    }
  }
);

// DELETE /:id/members/:personId - Remove a Person from a Group (Admin only)
router.delete(
  '/:id/members/:personId',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id, personId } = req.params;

    try {
      // Verify the group exists and belongs to the org
      const group = await db('groups')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      // Delete the person_groups row
      const deletedCount = await db('person_groups')
        .where({ person_id: personId, group_id: id })
        .del();

      if (deletedCount === 0) {
        res.status(404).json({ error: 'Member not found in group' });
        return;
      }

      res.status(200).json({ message: 'Member removed' });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
