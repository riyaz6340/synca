import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';

const router = Router();

/**
 * GET /undeliverable
 * Returns failed (undeliverable) notifications for the Admin's organization.
 * Joins with stakeholders table to include stakeholder name.
 * Supports pagination via `page` and `limit` query parameters.
 */
router.get(
  '/undeliverable',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
      const baseQuery = db('notifications')
        .where('notifications.organization_id', req.organizationId)
        .where('notifications.delivery_status', 'Failed');

      // Get total count for pagination
      const [{ count }] = await baseQuery.clone().count('* as count');
      const total = parseInt(count as string, 10);
      const totalPages = Math.ceil(total / limitNum);

      // Fetch paginated records with stakeholder name
      const records = await baseQuery
        .clone()
        .join('stakeholders', 'notifications.stakeholder_id', 'stakeholders.id')
        .select(
          'notifications.id',
          'notifications.stakeholder_id',
          'stakeholders.name as stakeholder_name',
          'notifications.type',
          'notifications.title',
          'notifications.body',
          'notifications.channel_used',
          'notifications.delivery_status',
          'notifications.created_at',
          'notifications.updated_at'
        )
        .orderBy('notifications.created_at', 'desc')
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
 * GET /unread-count
 * Returns the count of unread (Pending) notifications for the current user.
 * - Admin: count of all Pending notifications in the organization
 * - Stakeholder: count of Pending notifications for their stakeholder record
 */
router.get(
  '/unread-count',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const role = req.user!.role;
      const userId = req.user!.user_id;
      const organizationId = req.organizationId!;

      let query = db('notifications')
        .where('notifications.organization_id', organizationId)
        .where('notifications.delivery_status', 'Pending');

      if (role === 'Stakeholder') {
        const stakeholder = await db('stakeholders')
          .where('user_id', userId)
          .where('organization_id', organizationId)
          .first();

        if (!stakeholder) {
          res.status(200).json({ unread_count: 0 });
          return;
        }

        query = query.where('notifications.stakeholder_id', stakeholder.id);
      }

      const [{ count }] = await query.count('* as count');
      const unreadCount = parseInt(count as string, 10);

      res.status(200).json({ unread_count: unreadCount });
    } catch (error) {
      throw error;
    }
  }
);

/**
 * GET /
 * Returns notifications for the current user.
 * - Admin: all notifications for the organization
 * - Stakeholder: notifications linked to their stakeholder record
 * Supports pagination via `page` and `limit` query parameters.
 * Ordered by created_at descending.
 */
router.get(
  '/',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
      const role = req.user!.role;
      const userId = req.user!.user_id;
      const organizationId = req.organizationId!;

      let baseQuery = db('notifications').where('notifications.organization_id', organizationId);

      if (role === 'Stakeholder') {
        // Find the stakeholder record for this user
        const stakeholder = await db('stakeholders')
          .where('user_id', userId)
          .where('organization_id', organizationId)
          .first();

        if (!stakeholder) {
          res.status(200).json({
            data: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              totalPages: 0,
            },
          });
          return;
        }

        baseQuery = baseQuery.where('notifications.stakeholder_id', stakeholder.id);
      }

      // Get total count for pagination
      const [{ count }] = await baseQuery.clone().count('* as count');
      const total = parseInt(count as string, 10);
      const totalPages = Math.ceil(total / limitNum);

      // Fetch paginated records
      const records = await baseQuery
        .clone()
        .select(
          'notifications.id',
          'notifications.stakeholder_id',
          'notifications.type',
          'notifications.title',
          'notifications.body',
          'notifications.channel_used',
          'notifications.delivery_status',
          'notifications.sent_at',
          'notifications.created_at',
          'notifications.updated_at'
        )
        .orderBy('notifications.created_at', 'desc')
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

export default router;
