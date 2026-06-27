import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';
import { recordAttendance, bulkRecordAttendance } from '../services/attendanceService';

const router = Router();

const VALID_PRESENCE_STATUSES = ['Present', 'Absent', 'Late', 'On_Leave'];

// POST /bulk - Record attendance for all active Persons in a Group (Admin only)
// IMPORTANT: This route must be registered BEFORE any /:param routes
router.post(
  '/bulk',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { group_id, date, presence_status } = req.body;

    // Validate required fields
    if (!group_id) {
      res.status(400).json({ error: 'group_id is required' });
      return;
    }

    if (!date) {
      res.status(400).json({ error: 'date is required' });
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
      return;
    }

    if (!presence_status) {
      res.status(400).json({ error: 'presence_status is required' });
      return;
    }

    // Validate presence_status value
    if (!VALID_PRESENCE_STATUSES.includes(presence_status)) {
      res.status(400).json({
        error: `presence_status must be one of: ${VALID_PRESENCE_STATUSES.join(', ')}`,
      });
      return;
    }

    try {
      // Validate group belongs to the same organization
      const group = await db('groups')
        .where({ id: group_id, organization_id: req.organizationId })
        .first();
      if (!group) {
        res.status(400).json({ error: 'Group not found in your organization' });
        return;
      }

      // Fetch all active persons in the group that belong to the same organization
      const activePersons = await db('person_groups')
        .join('persons', 'person_groups.person_id', 'persons.id')
        .where('person_groups.group_id', group_id)
        .where('persons.is_active', true)
        .where('persons.organization_id', req.organizationId)
        .select('persons.id as person_id');

      if (activePersons.length === 0) {
        res.status(200).json({ message: 'No active persons found in group', count: 0, records: [] });
        return;
      }

      const inputs = activePersons.map((person) => ({
        organizationId: req.organizationId!,
        personId: person.person_id,
        date,
        presenceStatus: presence_status,
        recordedBy: req.user!.user_id,
      }));

      const records = await bulkRecordAttendance(inputs);

      res.status(201).json({
        message: 'Bulk attendance recorded',
        count: records.length,
        records,
      });
    } catch (error) {
      throw error;
    }
  }
);

// POST / - Record attendance for a single Person (Admin only)
router.post(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { person_id, date, presence_status } = req.body;

    // Validate required fields
    if (!person_id) {
      res.status(400).json({ error: 'person_id is required' });
      return;
    }

    if (!date) {
      res.status(400).json({ error: 'date is required' });
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
      return;
    }

    if (!presence_status) {
      res.status(400).json({ error: 'presence_status is required' });
      return;
    }

    // Validate presence_status value
    if (!VALID_PRESENCE_STATUSES.includes(presence_status)) {
      res.status(400).json({
        error: `presence_status must be one of: ${VALID_PRESENCE_STATUSES.join(', ')}`,
      });
      return;
    }

    try {
      // Validate person belongs to the same organization
      const person = await db('persons')
        .where({ id: person_id, organization_id: req.organizationId })
        .first();
      if (!person) {
        res.status(400).json({ error: 'Person not found in your organization' });
        return;
      }

      const record = await recordAttendance({
        organizationId: req.organizationId!,
        personId: person_id,
        date,
        presenceStatus: presence_status,
        recordedBy: req.user!.user_id,
      });

      res.status(201).json({ attendance: record });
    } catch (error) {
      throw error;
    }
  }
);

// GET / - Query attendance records with filters (Admin only)
router.get(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { start_date, end_date, person_id, group_id, page, limit } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Validate date formats if provided
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (start_date && !dateRegex.test(start_date as string)) {
      res.status(400).json({ error: 'start_date must be in YYYY-MM-DD format' });
      return;
    }
    if (end_date && !dateRegex.test(end_date as string)) {
      res.status(400).json({ error: 'end_date must be in YYYY-MM-DD format' });
      return;
    }

    try {
      let query = db('attendance_records')
        .where('attendance_records.organization_id', req.organizationId);

      // Apply date range filters
      if (start_date) {
        query = query.where('attendance_records.date', '>=', start_date as string);
      }
      if (end_date) {
        query = query.where('attendance_records.date', '<=', end_date as string);
      }

      // Apply person_id filter
      if (person_id) {
        query = query.where('attendance_records.person_id', person_id as string);
      }

      // Apply group_id filter (find persons in the group via person_groups join table)
      if (group_id) {
        query = query.whereIn(
          'attendance_records.person_id',
          db('person_groups')
            .select('person_id')
            .where('group_id', group_id as string)
        );
      }

      // Get total count for pagination
      const [{ count }] = await query.clone().count('* as count');
      const total = parseInt(count as string, 10);
      const totalPages = Math.ceil(total / limitNum);

      // Fetch paginated records ordered by date descending
      const records = await query
        .select('attendance_records.*')
        .orderBy('attendance_records.date', 'desc')
        .limit(limitNum)
        .offset(offset);

      // Format dates to avoid timezone shift issues
      const formattedRecords = records.map((r: { date: Date | string; [key: string]: unknown }) => ({
        ...r,
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
      }));

      res.status(200).json({
        data: formattedRecords,
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

// GET /:personId/today - Get today's attendance status for a Person (Admin and Stakeholder)
router.get(
  '/:personId/today',
  authenticate,
  tenantIsolation,
  authorize('Admin', 'Stakeholder'),
  async (req: Request, res: Response): Promise<void> => {
    const { personId } = req.params;

    try {
      // If Stakeholder, verify person is associated with them
      if (req.user!.role === 'Stakeholder') {
        const stakeholder = await db('stakeholders')
          .where('user_id', req.user!.user_id)
          .where('organization_id', req.organizationId)
          .first();

        if (!stakeholder) {
          res.status(403).json({ error: 'Forbidden: person is not associated with your account' });
          return;
        }

        const association = await db('person_stakeholders')
          .where('person_id', personId)
          .where('stakeholder_id', stakeholder.id)
          .first();

        if (!association) {
          res.status(403).json({ error: 'Forbidden: person is not associated with your account' });
          return;
        }
      } else {
        // Admin: verify person belongs to their organization
        const person = await db('persons')
          .where({ id: personId, organization_id: req.organizationId })
          .first();
        if (!person) {
          res.status(404).json({ error: 'Person not found in your organization' });
          return;
        }
      }

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const record = await db('attendance_records')
        .where('organization_id', req.organizationId)
        .where('person_id', personId)
        .where('date', today)
        .first();

      if (!record) {
        res.status(200).json({ attendance: null, message: 'No attendance record for today' });
        return;
      }

      res.status(200).json({ attendance: record });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
