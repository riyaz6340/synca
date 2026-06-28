import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';

const router = Router();

// GET / - List persons with filtering and pagination (Admin only)
router.get(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { group_id, is_active, page: pageParam, limit: limitParam } = req.query;

    const page = Math.max(1, parseInt(pageParam as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitParam as string, 10) || 20));
    const offset = (page - 1) * limit;

    try {
      // Build base query
      let baseQuery = db('persons').where('persons.organization_id', req.organizationId);

      // Apply is_active filter if provided
      if (is_active === 'true') {
        baseQuery = baseQuery.where('persons.is_active', true);
      } else if (is_active === 'false') {
        baseQuery = baseQuery.where('persons.is_active', false);
      }

      // Apply group_id filter via subquery if provided (validate group belongs to org)
      if (group_id && typeof group_id === 'string') {
        const groupExists = await db('groups')
          .where({ id: group_id, organization_id: req.organizationId })
          .first();
        if (!groupExists) {
          res.status(400).json({ error: 'Group not found in your organization' });
          return;
        }
        baseQuery = baseQuery.whereIn('persons.id', function () {
          this.select('person_id')
            .from('person_groups')
            .where('group_id', group_id);
        });
      }

      // Get total count
      const [{ count }] = await baseQuery.clone().count('persons.id as count');
      const total = parseInt(count as string, 10);

      // Get paginated results
      const data = await baseQuery
        .select('persons.*')
        .orderBy('persons.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (error) {
      throw error;
    }
  }
);

// GET /:id - Get person details including groups and stakeholders (Admin only)
router.get(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      // Find person by id AND organization_id (tenant isolation)
      const person = await db('persons')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!person) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }

      // Fetch associated groups via person_groups join
      const groups = await db('person_groups')
        .join('groups', 'person_groups.group_id', 'groups.id')
        .where('person_groups.person_id', id)
        .select(
          'groups.id',
          'groups.name',
          'groups.description',
          'groups.created_at',
          'groups.updated_at',
          'person_groups.assigned_at'
        );

      // Fetch associated stakeholders via person_stakeholders join
      const stakeholders = await db('person_stakeholders')
        .join('stakeholders', 'person_stakeholders.stakeholder_id', 'stakeholders.id')
        .where('person_stakeholders.person_id', id)
        .select(
          'stakeholders.id',
          'stakeholders.name',
          'stakeholders.communication_channels',
          'stakeholders.created_at',
          'stakeholders.updated_at',
          'person_stakeholders.relationship'
        );

      res.status(200).json({
        person: {
          ...person,
          groups,
          stakeholders,
        },
      });
    } catch (error) {
      throw error;
    }
  }
);

// POST / - Register a new Person (Admin only)
router.post(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const {
      name, contact_info, metadata, group_ids, stakeholders,
      roll_number, admission_number, age, gender, date_of_birth,
      blood_group, father_name, mother_name, guardian_name,
      guardian_relation, parent_mobile, parent_email, address,
    } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    try {
      const result = await db.transaction(async (trx) => {
        // Insert person with all fields
        const [person] = await trx('persons')
          .insert({
            organization_id: req.organizationId,
            name: name.trim(),
            roll_number: roll_number || null,
            admission_number: admission_number || null,
            age: age || null,
            gender: gender || null,
            date_of_birth: date_of_birth || null,
            blood_group: blood_group || null,
            father_name: father_name || null,
            mother_name: mother_name || null,
            guardian_name: guardian_name || null,
            guardian_relation: guardian_relation || null,
            parent_mobile: parent_mobile || null,
            parent_email: parent_email || null,
            address: address || null,
            contact_info: contact_info ? JSON.stringify(contact_info) : '{}',
            metadata: metadata ? JSON.stringify(metadata) : '{}',
            is_active: true,
          })
          .returning('*');

        // Insert person_groups if group_ids provided (validate they belong to org)
        let groups: Array<{ person_id: string; group_id: string; assigned_at: string }> = [];
        if (group_ids && Array.isArray(group_ids) && group_ids.length > 0) {
          const validGroups = await trx('groups')
            .whereIn('id', group_ids)
            .where('organization_id', req.organizationId)
            .select('id');
          const validGroupIds = validGroups.map((g: { id: string }) => g.id);
          const invalidGroupIds = group_ids.filter((id: string) => !validGroupIds.includes(id));
          if (invalidGroupIds.length > 0) {
            throw { status: 400, message: `Invalid group_ids not in your organization: ${invalidGroupIds.join(', ')}` };
          }
          const groupRows = group_ids.map((group_id: string) => ({
            person_id: person.id,
            group_id,
          }));
          groups = await trx('person_groups')
            .insert(groupRows)
            .returning('*');
        }

        // Insert person_stakeholders if stakeholders provided (validate they belong to org)
        let personStakeholders: Array<{ person_id: string; stakeholder_id: string; relationship: string }> = [];
        if (stakeholders && Array.isArray(stakeholders) && stakeholders.length > 0) {
          const stakeholderIds = stakeholders.map((s: { stakeholder_id: string }) => s.stakeholder_id);
          const validStakeholders = await trx('stakeholders')
            .whereIn('id', stakeholderIds)
            .where('organization_id', req.organizationId)
            .select('id');
          const validStakeholderIds = validStakeholders.map((s: { id: string }) => s.id);
          const invalidStakeholderIds = stakeholderIds.filter((id: string) => !validStakeholderIds.includes(id));
          if (invalidStakeholderIds.length > 0) {
            throw { status: 400, message: `Invalid stakeholder_ids not in your organization: ${invalidStakeholderIds.join(', ')}` };
          }
          const stakeholderRows = stakeholders.map(
            (s: { stakeholder_id: string; relationship: string }) => ({
              person_id: person.id,
              stakeholder_id: s.stakeholder_id,
              relationship: s.relationship,
            })
          );
          personStakeholders = await trx('person_stakeholders')
            .insert(stakeholderRows)
            .returning('*');
        }

        return { person, groups, stakeholders: personStakeholders };
      });

      // Auto-create or link parent account (non-blocking)
      if (result.person.parent_mobile) {
        void (async () => {
          try {
            const bcrypt = await import('bcrypt');
            const mobile = result.person.parent_mobile.replace(/[^0-9]/g, '').slice(-10);
            const loginId = result.person.admission_number || result.person.roll_number || result.person.id.substring(0, 8);

            // Check if a stakeholder with same mobile already exists (sibling)
            const existingStakeholder = await db('stakeholders')
              .where('organization_id', req.organizationId)
              .whereRaw("communication_channels::text LIKE ?", [`%${mobile}%`])
              .first();

            if (existingStakeholder) {
              // Link this child to existing parent
              await db('person_stakeholders')
                .insert({ person_id: result.person.id, stakeholder_id: existingStakeholder.id, relationship: 'parent' })
                .onConflict(['person_id', 'stakeholder_id']).ignore();
            } else {
              // Create new parent account
              const pwd = `${loginId}@${mobile}`;
              const passwordHash = await bcrypt.hash(pwd, 12);

              const existingUser = await db('users').where({ email: loginId, organization_id: req.organizationId }).first();
              if (!existingUser) {
                const [parentUser] = await db('users')
                  .insert({ organization_id: req.organizationId, email: loginId, password_hash: passwordHash, role: 'Stakeholder' })
                  .returning('*');

                const parentName = result.person.guardian_name || result.person.father_name || `Parent of ${result.person.name}`;
                const [stakeholder] = await db('stakeholders')
                  .insert({
                    organization_id: req.organizationId, user_id: parentUser.id, name: parentName,
                    communication_channels: JSON.stringify([
                      ...(result.person.parent_mobile ? [{ type: 'sms', config: { phone: result.person.parent_mobile }, priority: 1 }] : []),
                    ]),
                  }).returning('*');

                await db('person_stakeholders')
                  .insert({ person_id: result.person.id, stakeholder_id: stakeholder.id, relationship: 'parent' })
                  .onConflict(['person_id', 'stakeholder_id']).ignore();
              }
            }
          } catch { /* non-critical */ }
        })();
      }

      res.status(201).json(result);
    } catch (error) {
      // Handle custom validation errors from transaction
      if ((error as { status?: number }).status === 400) {
        res.status(400).json({ error: (error as { message: string }).message });
        return;
      }
      // Handle foreign key violations (invalid group_id or stakeholder_id)
      if ((error as { code?: string }).code === '23503') {
        res.status(400).json({ error: 'Invalid group_id or stakeholder_id reference' });
        return;
      }
      throw error;
    }
  }
);

// PUT /:id - Update Person details (Admin only)
router.put(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
      name, contact_info, metadata,
      roll_number, admission_number, age, gender, date_of_birth,
      blood_group, father_name, mother_name, guardian_name,
      guardian_relation, parent_mobile, parent_email, address,
    } = req.body;

    try {
      // Find person by id AND organization_id (tenant isolation)
      const person = await db('persons')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!person) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }

      // Build update object with only provided fields
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          res.status(400).json({ error: 'Name must be a non-empty string' });
          return;
        }
        updates.name = name.trim();
      }

      if (contact_info !== undefined) updates.contact_info = JSON.stringify(contact_info);
      if (metadata !== undefined) updates.metadata = JSON.stringify(metadata);
      if (roll_number !== undefined) updates.roll_number = roll_number || null;
      if (admission_number !== undefined) updates.admission_number = admission_number || null;
      if (age !== undefined) updates.age = age || null;
      if (gender !== undefined) updates.gender = gender || null;
      if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth || null;
      if (blood_group !== undefined) updates.blood_group = blood_group || null;
      if (father_name !== undefined) updates.father_name = father_name || null;
      if (mother_name !== undefined) updates.mother_name = mother_name || null;
      if (guardian_name !== undefined) updates.guardian_name = guardian_name || null;
      if (guardian_relation !== undefined) updates.guardian_relation = guardian_relation || null;
      if (parent_mobile !== undefined) updates.parent_mobile = parent_mobile || null;
      if (parent_email !== undefined) updates.parent_email = parent_email || null;
      if (address !== undefined) updates.address = address || null;

      // Update the person record
      const [updatedPerson] = await db('persons')
        .where({ id, organization_id: req.organizationId })
        .update(updates)
        .returning('*');

      res.status(200).json({ person: updatedPerson });
    } catch (error) {
      throw error;
    }
  }
);

// PATCH /:id/deactivate - Deactivate a Person (Admin only)
router.patch(
  '/:id/deactivate',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      // Find person by id AND organization_id (tenant isolation)
      const person = await db('persons')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!person) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }

      // Set is_active = false and update updated_at
      const [updatedPerson] = await db('persons')
        .where({ id, organization_id: req.organizationId })
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .returning('*');

      res.status(200).json({
        message: 'Person deactivated successfully',
        person: updatedPerson,
      });
    } catch (error) {
      throw error;
    }
  }
);

// DELETE /:id - Permanently delete a Person (Admin only)
router.delete(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const person = await db('persons')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!person) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }

      await db('persons')
        .where({ id, organization_id: req.organizationId })
        .del();

      res.status(200).json({ message: 'Person deleted successfully' });
    } catch (error) {
      throw error;
    }
  }
);

// POST /:id/create-parent-account - Create parent login credentials for a student (Admin only)
router.post(
  '/:id/create-parent-account',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { password, relationship, link_to_existing } = req.body;

    try {
      const person = await db('persons')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!person) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }

      // Password format: admissionNumber@mobileNumber
      if (!person.parent_mobile) {
        res.status(400).json({ error: 'Parent mobile number is required to create parent account. Please update the student record first.' });
        return;
      }

      const mobile = person.parent_mobile.replace(/[^0-9]/g, '').slice(-10);
      const loginId = person.admission_number || person.roll_number || person.id.substring(0, 8);
      const pwd = password || `${loginId}@${mobile}`;

      // Check if this student is already linked to a stakeholder
      const existingLink = await db('person_stakeholders')
        .where('person_id', person.id)
        .first();

      if (existingLink) {
        // Already linked — find the stakeholder's login
        const stakeholder = await db('stakeholders').where('id', existingLink.stakeholder_id).first();
        const parentUser = stakeholder ? await db('users').where('id', stakeholder.user_id).first() : null;
        res.status(200).json({
          message: 'Student is already linked to a parent account',
          credentials: { login: parentUser?.email || loginId, password: '(use existing password or reset)' },
          parent_user: parentUser ? { id: parentUser.id, email: parentUser.email } : null,
        });
        return;
      }

      // Check if a parent account with same mobile exists (for linking siblings)
      const existingStakeholderByMobile = await db('stakeholders')
        .where('organization_id', req.organizationId)
        .whereRaw("communication_channels::text LIKE ?", [`%${mobile}%`])
        .first();

      if (existingStakeholderByMobile && link_to_existing !== false) {
        // Link this child to the existing parent (sibling scenario)
        await db('person_stakeholders')
          .insert({
            person_id: person.id,
            stakeholder_id: existingStakeholderByMobile.id,
            relationship: relationship || 'parent',
          })
          .onConflict(['person_id', 'stakeholder_id'])
          .ignore();

        const parentUser = await db('users').where('id', existingStakeholderByMobile.user_id).first();

        res.status(200).json({
          message: `Child linked to existing parent account (${existingStakeholderByMobile.name}). Same login works for all children.`,
          credentials: { login: parentUser?.email || 'existing login', password: '(same as before)' },
          linked_children: 'This parent can now see all linked children in one login',
        });
        return;
      }

      // No existing account — create new one
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(pwd, 12);

      // Check if user with this loginId already exists
      const existingUser = await db('users')
        .where({ email: loginId, organization_id: req.organizationId })
        .first();

      if (existingUser) {
        res.status(400).json({ error: `Login "${loginId}" already exists. If this is a sibling, the system will auto-link using the same mobile number.` });
        return;
      }

      // Create parent user
      const [parentUser] = await db('users')
        .insert({
          organization_id: req.organizationId,
          email: loginId,
          password_hash: passwordHash,
          role: 'Stakeholder',
        })
        .returning('*');

      // Create stakeholder record
      const parentName = person.guardian_name || person.father_name || `Parent of ${person.name}`;
      const [stakeholder] = await db('stakeholders')
        .insert({
          organization_id: req.organizationId,
          user_id: parentUser.id,
          name: parentName,
          communication_channels: JSON.stringify([
            ...(person.parent_email ? [{ type: 'email', config: { address: person.parent_email }, priority: 1 }] : []),
            ...(person.parent_mobile ? [{ type: 'sms', config: { phone: person.parent_mobile }, priority: 2 }] : []),
          ]),
        })
        .returning('*');

      // Link stakeholder to person
      await db('person_stakeholders')
        .insert({
          person_id: person.id,
          stakeholder_id: stakeholder.id,
          relationship: relationship || 'parent',
        })
        .onConflict(['person_id', 'stakeholder_id'])
        .ignore();

      res.status(201).json({
        message: 'Parent account created successfully',
        credentials: {
          login: loginId,
          password: pwd,
        },
        parent_user: { id: parentUser.id, email: parentUser.email },
        stakeholder: { id: stakeholder.id, name: stakeholder.name },
      });
    } catch (error) {
      throw error;
    }
  }
);

// POST /:id/reset-parent-password - Reset parent password for a student (Admin only)
router.post(
  '/:id/reset-parent-password',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const person = await db('persons')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!person) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }

      const loginId = person.admission_number || person.roll_number || person.id.substring(0, 8);

      if (!person.parent_mobile) {
        res.status(400).json({ error: 'Parent mobile number is required. Please update the student record first.' });
        return;
      }

      const mobile = person.parent_mobile.replace(/[^0-9]/g, '').slice(-10);
      const newPwd = `${loginId}@${mobile}`;

      // Find the parent user
      const parentUser = await db('users')
        .where({ email: loginId, organization_id: req.organizationId })
        .first();

      if (!parentUser) {
        res.status(404).json({ error: `No parent account found with login: ${loginId}. Create one first.` });
        return;
      }

      // Reset password
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(newPwd, 12);
      await db('users').where({ id: parentUser.id }).update({ password_hash: passwordHash, updated_at: new Date() });

      res.status(200).json({
        message: 'Parent password reset successfully',
        credentials: {
          login: loginId,
          password: newPwd,
        },
      });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
