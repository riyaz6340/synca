import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';

const router = Router();

/**
 * GET / — List holidays for the organization.
 * Supports optional year/month query params for filtering.
 * Accessible by both Admin and Stakeholder.
 */
router.get(
  '/',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    const { year, month } = req.query;

    let query = db('holidays')
      .where('organization_id', req.organizationId)
      .orderBy('date', 'asc');

    if (year) {
      query = query.whereRaw("EXTRACT(YEAR FROM date) = ?", [Number(year)]);
    }
    if (month) {
      query = query.whereRaw("EXTRACT(MONTH FROM date) = ?", [Number(month)]);
    }

    const holidays = await query.select('*');
    res.json({ holidays });
  }
);

/**
 * POST / — Create a holiday (Admin only).
 * Body: { date, name, type?, description? }
 */
router.post(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { date, name, type, description } = req.body;

    if (!date || !name) {
      res.status(400).json({ error: 'date and name are required' });
      return;
    }

    try {
      const [holiday] = await db('holidays')
        .insert({
          organization_id: req.organizationId,
          date,
          name: name.trim(),
          type: type || 'holiday',
          description: description || null,
        })
        .returning('*');

      res.status(201).json({ holiday });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        res.status(400).json({ error: 'A holiday already exists on this date' });
        return;
      }
      throw error;
    }
  }
);

/**
 * DELETE /:id — Delete a holiday (Admin only).
 */
router.delete(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const deleted = await db('holidays')
      .where({ id, organization_id: req.organizationId })
      .del();

    if (!deleted) {
      res.status(404).json({ error: 'Holiday not found' });
      return;
    }

    res.json({ message: 'Holiday deleted' });
  }
);

/**
 * POST /bulk — Add multiple holidays at once (Admin only).
 * Body: { holidays: [{ date, name, type?, description? }] }
 */
router.post(
  '/bulk',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { holidays } = req.body;

    if (!Array.isArray(holidays) || holidays.length === 0) {
      res.status(400).json({ error: 'holidays must be a non-empty array' });
      return;
    }

    const rows = holidays.map((h: { date: string; name: string; type?: string; description?: string }) => ({
      organization_id: req.organizationId,
      date: h.date,
      name: h.name.trim(),
      type: h.type || 'holiday',
      description: h.description || null,
    }));

    try {
      const result = await db('holidays')
        .insert(rows)
        .onConflict(['organization_id', 'date'])
        .ignore()
        .returning('*');

      res.status(201).json({ added: result.length, holidays: result });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
