import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';

const router = Router();

// Apply middleware chain: authenticate → tenantIsolation → authorize(Admin)
router.get(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const organization = await db('organizations')
      .where({ id: req.organizationId })
      .first();

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({ organization });
  }
);

// PUT / - Update organization settings and metadata (Admin only)
router.put(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { name, industry_module, metadata } = req.body;

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (industry_module !== undefined) updates.industry_module = industry_module;
    if (metadata !== undefined) updates.metadata = JSON.stringify(metadata);

    // Always update the timestamp
    updates.updated_at = new Date();

    const [updated] = await db('organizations')
      .where({ id: req.organizationId })
      .update(updates)
      .returning('*');

    if (!updated) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({ organization: updated });
  }
);

export default router;
