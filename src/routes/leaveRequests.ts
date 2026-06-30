import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';
import { createNotification } from '../services/notificationService';
import { createLeaveAttendanceRecords } from '../services/leaveAttendanceService';
import { logAudit } from '../utils/auditLog';

const router = Router();

/**
 * GET /
 * Returns leave requests based on the user's role:
 * - Admin: all leave requests for the organization
 * - Stakeholder: only leave requests where requested_by = their stakeholder record
 * Supports pagination via `page` and `limit` query parameters.
 * Ordered by created_at descending.
 */
router.get(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin', 'Stakeholder'),
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
      const role = req.user!.role;
      const userId = req.user!.user_id;
      const organizationId = req.organizationId!;

      let baseQuery = db('leave_requests').where('leave_requests.organization_id', organizationId);

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

        baseQuery = baseQuery.where('leave_requests.requested_by', stakeholder.id);
      }

      // Get total count for pagination
      const [{ count }] = await baseQuery.clone().count('* as count');
      const total = parseInt(count as string, 10);
      const totalPages = Math.ceil(total / limitNum);

      // Fetch paginated records with person name and group info
      const records = await baseQuery
        .clone()
        .join('persons', 'leave_requests.person_id', 'persons.id')
        .leftJoin('person_groups', 'persons.id', 'person_groups.person_id')
        .leftJoin('groups', 'person_groups.group_id', 'groups.id')
        .select(
          'leave_requests.id',
          'leave_requests.organization_id',
          'leave_requests.person_id',
          'leave_requests.requested_by',
          'leave_requests.start_date',
          'leave_requests.end_date',
          'leave_requests.reason',
          'leave_requests.status',
          'leave_requests.reviewed_by',
          'leave_requests.review_comment',
          'leave_requests.created_at',
          'leave_requests.updated_at',
          'persons.name as person_name',
          'persons.metadata as person_metadata',
          'groups.name as group_name'
        )
        .orderBy('leave_requests.created_at', 'desc')
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
 * GET /:id
 * Returns a specific leave request by ID.
 * - Admin: can view any leave request within the organization
 * - Stakeholder: can only view their own leave requests (requested_by must match their stakeholder_id)
 */
router.get(
  '/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin', 'Stakeholder'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const organizationId = req.organizationId!;

      // Find leave request by id AND organization_id (tenant isolation)
      const leaveRequest = await db('leave_requests')
        .where('id', id)
        .where('organization_id', organizationId)
        .first();

      if (!leaveRequest) {
        res.status(404).json({ error: 'Leave request not found' });
        return;
      }

      // If user is Stakeholder, verify the leave request belongs to them
      if (req.user!.role === 'Stakeholder') {
        const stakeholder = await db('stakeholders')
          .where('user_id', req.user!.user_id)
          .where('organization_id', organizationId)
          .first();

        if (!stakeholder || leaveRequest.requested_by !== stakeholder.id) {
          res.status(403).json({ error: 'Forbidden: you can only view your own leave requests' });
          return;
        }
      }

      res.status(200).json({ leave_request: leaveRequest });
    } catch (error) {
      throw error;
    }
  }
);

// POST / - Submit a leave request (Stakeholder, Admin)
router.post(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Stakeholder', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { person_id, start_date, end_date, reason } = req.body;

    // Validate required fields
    if (!person_id) {
      res.status(400).json({ error: 'person_id is required' });
      return;
    }

    if (!start_date) {
      res.status(400).json({ error: 'start_date is required' });
      return;
    }

    if (!end_date) {
      res.status(400).json({ error: 'end_date is required' });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date)) {
      res.status(400).json({ error: 'start_date must be in YYYY-MM-DD format' });
      return;
    }

    if (!dateRegex.test(end_date)) {
      res.status(400).json({ error: 'end_date must be in YYYY-MM-DD format' });
      return;
    }

    // Validate end_date >= start_date
    if (end_date < start_date) {
      res.status(400).json({ error: 'end_date must be greater than or equal to start_date' });
      return;
    }

    try {
      // Find the stakeholder record for the authenticated user
      const stakeholder = await db('stakeholders')
        .where('user_id', req.user!.user_id)
        .where('organization_id', req.organizationId)
        .first();

      if (!stakeholder) {
        res.status(404).json({ error: 'Stakeholder record not found for current user' });
        return;
      }

      // Validate person belongs to the same organization
      const person = await db('persons')
        .where({ id: person_id, organization_id: req.organizationId })
        .first();
      if (!person) {
        res.status(400).json({ error: 'Person not found in your organization' });
        return;
      }

      // If Stakeholder, verify person is associated with them
      if (req.user!.role === 'Stakeholder') {
        const association = await db('person_stakeholders')
          .where('person_id', person_id)
          .where('stakeholder_id', stakeholder.id)
          .first();
        if (!association) {
          res.status(403).json({ error: 'Forbidden: person is not associated with your account' });
          return;
        }
      }

      // Insert the leave request
      const [leaveRequest] = await db('leave_requests')
        .insert({
          organization_id: req.organizationId,
          person_id,
          requested_by: stakeholder.id,
          start_date,
          end_date,
          reason,
          status: 'Pending',
        })
        .returning('*');

      res.status(201).json({ leave_request: leaveRequest });
    } catch (error) {
      throw error;
    }
  }
);

/**
 * PUT /:id/approve
 * Approve a leave request (Admin only).
 * - Updates status to 'Approved'
 * - Sets reviewed_by to the current user
 * - Sends a confirmation notification to the requesting stakeholder
 */
router.put(
  '/:id/approve',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const organizationId = req.organizationId!;
      const userId = req.user!.user_id;

      // Find leave request by id AND organization_id (tenant isolation)
      const leaveRequest = await db('leave_requests')
        .where('id', id)
        .where('organization_id', organizationId)
        .first();

      if (!leaveRequest) {
        res.status(404).json({ error: 'Leave request not found' });
        return;
      }

      // Check that status is Pending
      if (leaveRequest.status !== 'Pending') {
        res.status(400).json({ error: 'Leave request has already been reviewed' });
        return;
      }

      // Update leave request to Approved
      const [updatedLeaveRequest] = await db('leave_requests')
        .where('id', id)
        .where('organization_id', organizationId)
        .update({
          status: 'Approved',
          reviewed_by: userId,
          updated_at: db.fn.now(),
        })
        .returning('*');

      // Send confirmation notification to the requesting stakeholder
      await createNotification({
        organizationId,
        stakeholderId: leaveRequest.requested_by,
        type: 'leave_approved',
        title: 'Leave Request Approved',
        body: `Your leave request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been approved.`,
      });

      // Audit log: leave request approved
      void logAudit({
        organization_id: organizationId,
        user_id: userId,
        action: 'UPDATE',
        entity_type: 'leave_request',
        entity_id: id as string,
        details: { status: 'Approved' },
        ip_address: req.ip,
      });

      // Auto-create Attendance_Records with On_Leave for each date in the leave range (fire and forget)
      void (async () => {
        try {
          await createLeaveAttendanceRecords({
            organizationId,
            personId: leaveRequest.person_id,
            startDate: leaveRequest.start_date,
            endDate: leaveRequest.end_date,
            recordedBy: userId,
          });
        } catch {
          // Silently catch errors to not fail the approval response
        }
      })();

      res.status(200).json({ leave_request: updatedLeaveRequest });
    } catch (error) {
      throw error;
    }
  }
);

/**
 * PUT /:id/reject
 * Reject a leave request (Admin only).
 * - Updates status to 'Rejected'
 * - Sets reviewed_by to the current user and review_comment to the rejection reason
 * - Sends a rejection notification to the requesting stakeholder
 */
router.put(
  '/:id/reject',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { review_comment } = req.body;

    // Validate review_comment is provided
    if (!review_comment) {
      res.status(400).json({ error: 'review_comment is required' });
      return;
    }

    try {
      const organizationId = req.organizationId!;
      const userId = req.user!.user_id;

      // Find leave request by id AND organization_id (tenant isolation)
      const leaveRequest = await db('leave_requests')
        .where('id', id)
        .where('organization_id', organizationId)
        .first();

      if (!leaveRequest) {
        res.status(404).json({ error: 'Leave request not found' });
        return;
      }

      // Check that status is Pending
      if (leaveRequest.status !== 'Pending') {
        res.status(400).json({ error: 'Leave request has already been reviewed' });
        return;
      }

      // Update leave request to Rejected
      const [updatedLeaveRequest] = await db('leave_requests')
        .where('id', id)
        .where('organization_id', organizationId)
        .update({
          status: 'Rejected',
          reviewed_by: userId,
          review_comment,
          updated_at: db.fn.now(),
        })
        .returning('*');

      // Send rejection notification to the requesting stakeholder
      await createNotification({
        organizationId,
        stakeholderId: leaveRequest.requested_by,
        type: 'leave_rejected',
        title: 'Leave Request Rejected',
        body: `Your leave request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been rejected. Reason: ${review_comment}`,
      });

      // Audit log: leave request rejected
      void logAudit({
        organization_id: organizationId,
        user_id: userId,
        action: 'UPDATE',
        entity_type: 'leave_request',
        entity_id: id as string,
        details: { status: 'Rejected', review_comment },
        ip_address: req.ip,
      });

      res.status(200).json({ leave_request: updatedLeaveRequest });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
