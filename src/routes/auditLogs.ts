import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';

const router = Router();

/**
 * GET / — Admin only, list recent audit entries for the organization.
 * Supports optional filtering by entity_type and action.
 */
router.get(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { limit = '50', entity_type, action } = req.query;

    let query = db('audit_logs')
      .where('organization_id', req.organizationId)
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit as string, 10));

    if (entity_type) query = query.where('entity_type', entity_type as string);
    if (action) query = query.where('action', action as string);

    const logs = await query;
    res.json({ data: logs });
  }
);

export default router;
