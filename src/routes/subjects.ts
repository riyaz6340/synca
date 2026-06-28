import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';

const router = Router();

/**
 * GET / — List subjects for a class (group_id query param required)
 */
router.get(
  '/',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    const { group_id } = req.query;

    if (!group_id) {
      res.status(400).json({ error: 'group_id query parameter is required' });
      return;
    }

    const subjects = await db('subjects')
      .where({ organization_id: req.organizationId, group_id: group_id as string })
      .orderBy('period_number', 'asc');

    res.json({ subjects });
  }
);

/**
 * POST / — Create a subject for a class (Admin only)
 * Body: { group_id, name, teacher_name?, period_number? }
 */
router.post(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { group_id, name, teacher_name, period_number } = req.body;

    if (!group_id || !name) {
      res.status(400).json({ error: 'group_id and name are required' });
      return;
    }

    // Verify group belongs to org
    const group = await db('groups').where({ id: group_id, organization_id: req.organizationId }).first();
    if (!group) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    const [subject] = await db('subjects')
      .insert({
        organization_id: req.organizationId,
        group_id,
        name: name.trim(),
        teacher_name: teacher_name || null,
        period_number: period_number || null,
      })
      .returning('*');

    res.status(201).json({ subject });
  }
);

/**
 * DELETE /:id — Delete a subject (Admin only)
 */
router.delete(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const deleted = await db('subjects').where({ id, organization_id: req.organizationId }).del();
    if (!deleted) { res.status(404).json({ error: 'Subject not found' }); return; }
    res.json({ message: 'Subject deleted' });
  }
);

export default router;
