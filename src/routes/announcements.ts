import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';
import { createNotificationsForStakeholders } from '../services/notificationService';

const router = Router();

const VALID_TARGET_TYPES = ['Organization', 'Group', 'Person'] as const;

/**
 * POST /
 * Create a new announcement (Admin only).
 * Accepts title, body, target_type, target_ids, and optional scheduled_at.
 */
router.post(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { title, body, target_type, target_ids, scheduled_at } = req.body;

    // Validate required fields
    if (!title || !body || !target_type || !target_ids) {
      res.status(400).json({ error: 'title, body, target_type, and target_ids are required' });
      return;
    }

    // Validate target_type enum
    if (!VALID_TARGET_TYPES.includes(target_type)) {
      res.status(400).json({
        error: `target_type must be one of: ${VALID_TARGET_TYPES.join(', ')}`,
      });
      return;
    }

    // Validate target_ids — required only for Group and Person target types
    if (target_type !== 'Organization') {
      if (!Array.isArray(target_ids) || target_ids.length === 0) {
        res.status(400).json({ error: 'target_ids must be a non-empty array for Group or Person target types' });
        return;
      }
    }

    // For Organization target, use empty array or org_id
    const resolvedTargetIds = target_type === 'Organization' ? [req.organizationId] : target_ids;

    // Validate scheduled_at is a valid ISO timestamp if provided
    if (scheduled_at !== undefined && scheduled_at !== null) {
      const parsedDate = new Date(scheduled_at);
      if (isNaN(parsedDate.getTime())) {
        res.status(400).json({ error: 'scheduled_at must be a valid ISO timestamp' });
        return;
      }
    }

    try {
      const [announcement] = await db('announcements')
        .insert({
          organization_id: req.organizationId,
          title,
          body,
          target_type,
          target_ids: resolvedTargetIds,
          scheduled_at: scheduled_at || null,
          created_by: req.user!.user_id,
        })
        .returning('*');

      res.status(201).json(announcement);
    } catch (error) {
      throw error;
    }
  }
);

/**
 * GET /
 * List announcements for the organization (Admin only).
 * Supports pagination via `page` and `limit` query parameters.
 * Ordered by created_at descending.
 */
router.get(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
      const baseQuery = db('announcements').where(
        'organization_id',
        req.organizationId
      );

      // Get total count for pagination
      const [{ count }] = await baseQuery.clone().count('* as count');
      const total = parseInt(count as string, 10);
      const totalPages = Math.ceil(total / limitNum);

      // Fetch paginated records ordered by created_at descending
      const records = await baseQuery
        .clone()
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(limitNum)
        .offset(offset);

      res.status(200).json({
        data: records,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      });
    } catch (error) {
      throw error;
    }
  }
);

/**
 * PUT /:id
 * Update an announcement before publication (Admin only).
 * Only announcements that have not been published (published_at is null) can be updated.
 * Accepts optional fields: title, body, target_type, target_ids, scheduled_at.
 */
router.put(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { title, body, target_type, target_ids, scheduled_at } = req.body;

    try {
      // Find announcement by id AND organization_id
      const announcement = await db('announcements')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!announcement) {
        res.status(404).json({ error: 'Announcement not found' });
        return;
      }

      // Check if already published
      if (announcement.published_at !== null) {
        res.status(400).json({ error: 'Cannot update a published announcement' });
        return;
      }

      // Validate target_type if provided
      if (target_type !== undefined && !VALID_TARGET_TYPES.includes(target_type)) {
        res.status(400).json({
          error: `target_type must be one of: ${VALID_TARGET_TYPES.join(', ')}`,
        });
        return;
      }

      // Validate target_ids if provided
      if (target_ids !== undefined) {
        if (!Array.isArray(target_ids) || target_ids.length === 0) {
          res.status(400).json({ error: 'target_ids must be a non-empty array of UUIDs' });
          return;
        }
      }

      // Validate scheduled_at if provided
      if (scheduled_at !== undefined && scheduled_at !== null) {
        const parsedDate = new Date(scheduled_at);
        if (isNaN(parsedDate.getTime())) {
          res.status(400).json({ error: 'scheduled_at must be a valid ISO timestamp' });
          return;
        }
      }

      // Build update object with only provided fields
      const updateFields: Record<string, unknown> = { updated_at: new Date() };

      if (title !== undefined) updateFields.title = title;
      if (body !== undefined) updateFields.body = body;
      if (target_type !== undefined) updateFields.target_type = target_type;
      if (target_ids !== undefined) updateFields.target_ids = target_ids;
      if (scheduled_at !== undefined) updateFields.scheduled_at = scheduled_at || null;

      const [updated] = await db('announcements')
        .where({ id, organization_id: req.organizationId })
        .update(updateFields)
        .returning('*');

      res.status(200).json(updated);
    } catch (error) {
      throw error;
    }
  }
);

/**
 * POST /:id/publish
 * Publish an announcement immediately and send notifications to targeted stakeholders (Admin only).
 * Returns 404 if not found, 400 if already published.
 */
router.post(
  '/:id/publish',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      // Find announcement by id AND organization_id
      const announcement = await db('announcements')
        .where({ id, organization_id: req.organizationId })
        .first();

      if (!announcement) {
        res.status(404).json({ error: 'Announcement not found' });
        return;
      }

      // Check if already published
      if (announcement.published_at !== null) {
        res.status(400).json({ error: 'Announcement is already published' });
        return;
      }

      // Update published_at and updated_at
      const now = new Date();
      const [updated] = await db('announcements')
        .where({ id, organization_id: req.organizationId })
        .update({ published_at: now, updated_at: now })
        .returning('*');

      // Determine target stakeholders based on target_type
      const targetIds: string[] = Array.isArray(announcement.target_ids)
        ? announcement.target_ids
        : JSON.parse(announcement.target_ids);

      let stakeholderIds: string[] = [];

      if (announcement.target_type === 'Organization') {
        // Get ALL stakeholders in the organization
        const stakeholders = await db('stakeholders')
          .where({ organization_id: req.organizationId })
          .select('id');
        stakeholderIds = stakeholders.map((s: { id: string }) => s.id);
      } else if (announcement.target_type === 'Group') {
        // Get stakeholders of persons in the specified groups
        const stakeholders = await db('person_stakeholders')
          .join('person_groups', 'person_stakeholders.person_id', 'person_groups.person_id')
          .whereIn('person_groups.group_id', targetIds)
          .select('person_stakeholders.stakeholder_id')
          .distinct();
        stakeholderIds = stakeholders.map((s: { stakeholder_id: string }) => s.stakeholder_id);
      } else if (announcement.target_type === 'Person') {
        // Get stakeholders of the specified persons
        const stakeholders = await db('person_stakeholders')
          .whereIn('person_id', targetIds)
          .select('stakeholder_id')
          .distinct();
        stakeholderIds = stakeholders.map((s: { stakeholder_id: string }) => s.stakeholder_id);
      }

      // Send notifications to all target stakeholders (non-blocking)
      if (stakeholderIds.length > 0) {
        createNotificationsForStakeholders(
          stakeholderIds,
          req.organizationId!,
          'announcement',
          updated.title,
          updated.body
        ).catch(() => {
          // Non-blocking: log error but don't fail the request
        });
      }

      res.status(200).json(updated);
    } catch (error) {
      throw error;
    }
  }
);

export default router;
