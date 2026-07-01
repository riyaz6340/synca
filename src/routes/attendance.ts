import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import { requirePermission } from '../middleware/requirePermission';
import { isAssignedToGroup } from '../services/teacherGroupService';
import db from '../config/database';
import { recordAttendance, bulkRecordAttendance } from '../services/attendanceService';
import { logAudit } from '../utils/auditLog';

const router = Router();

const VALID_PRESENCE_STATUSES = ['Present', 'Absent', 'Late', 'On_Leave'];

// GET /group/:groupId/members - Get group members sorted by roll_number for sequential attendance
router.get(
  '/group/:groupId/members',
  authenticate,
  tenantIsolation,
  requirePermission('mark_attendance'),
  async (req: Request, res: Response): Promise<void> => {
    const groupId = req.params.groupId as string;

    try {
      // Validate group belongs to the caller's organization
      const group = await db('groups')
        .where({ id: groupId, organization_id: req.organizationId })
        .first();

      if (!group) {
        res.status(404).json({ error: 'Group not found in your organization' });
        return;
      }

      // For Teacher role: additionally validate they are assigned to this group
      if (req.user!.role === 'Teacher') {
        const assigned = await isAssignedToGroup(req.user!.user_id, groupId);
        if (!assigned) {
          res.status(403).json({ error: 'Forbidden: you are not assigned to this group' });
          return;
        }
      }

      // Query person_groups joined with persons to get member details
      // Sort: roll_number ASC NULLS LAST, then name ASC for those with null roll_number
      const members = await db('person_groups')
        .join('persons', 'person_groups.person_id', 'persons.id')
        .where('person_groups.group_id', groupId)
        .where('persons.is_active', true)
        .where('persons.organization_id', req.organizationId)
        .select(
          'persons.id as person_id',
          'persons.name',
          'person_groups.roll_number'
        )
        .orderByRaw('person_groups.roll_number ASC NULLS LAST')
        .orderBy('persons.name', 'asc');

      const result = members.map((m) => ({
        person_id: m.person_id,
        name: m.name,
        roll_number: m.roll_number ?? null,
        photo_url: null, // photo_url not yet stored in persons table
      }));

      res.status(200).json({ members: result });
    } catch (error) {
      throw error;
    }
  }
);

// POST /bulk - Record attendance for all active Persons in a Group (Admin and Teacher with mark_attendance)
// IMPORTANT: This route must be registered BEFORE any /:param routes
router.post(
  '/bulk',
  authenticate,
  tenantIsolation,
  authorize('Admin', 'Teacher'),
  requirePermission('mark_attendance'),
  async (req: Request, res: Response): Promise<void> => {
    const { group_id, date, presence_status, records } = req.body;

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

    // Determine mode: per-student records payload vs. whole-group single status.
    const hasRecords = Array.isArray(records) && records.length > 0;

    if (records !== undefined && !Array.isArray(records)) {
      res.status(400).json({ error: 'records must be an array' });
      return;
    }

    // In whole-group mode, presence_status is required and must be valid.
    if (!hasRecords) {
      if (!presence_status) {
        res.status(400).json({ error: 'presence_status is required' });
        return;
      }

      if (!VALID_PRESENCE_STATUSES.includes(presence_status)) {
        res.status(400).json({
          error: `presence_status must be one of: ${VALID_PRESENCE_STATUSES.join(', ')}`,
        });
        return;
      }
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

      // For Teacher role: validate they are assigned to the target group
      if (req.user!.role === 'Teacher') {
        const assigned = await isAssignedToGroup(req.user!.user_id, group_id);
        if (!assigned) {
          res.status(403).json({ error: 'Forbidden: you are not assigned to this group' });
          return;
        }
      }

      // ── Per-student mode ──────────────────────────────────────────────────
      if (hasRecords) {
        // Validate the shape and presence_status of each record up front.
        for (const record of records) {
          if (!record || typeof record !== 'object' || !record.person_id) {
            res.status(400).json({ error: 'Each record must include a person_id' });
            return;
          }
          if (!VALID_PRESENCE_STATUSES.includes(record.presence_status)) {
            res.status(400).json({
              error: `presence_status must be one of: ${VALID_PRESENCE_STATUSES.join(', ')}`,
            });
            return;
          }
        }

        // Fetch all active members of the group within the caller's org.
        const activeMembers = await db('person_groups')
          .join('persons', 'person_groups.person_id', 'persons.id')
          .where('person_groups.group_id', group_id)
          .where('persons.is_active', true)
          .where('persons.organization_id', req.organizationId)
          .select('persons.id as person_id');

        const validPersonIds = new Set(activeMembers.map((m) => m.person_id));

        // Reject if any record targets a person who is not an active member of
        // the group in this organization.
        const invalidPersonIds = records
          .map((r: { person_id: string }) => r.person_id)
          .filter((id: string) => !validPersonIds.has(id));

        if (invalidPersonIds.length > 0) {
          res.status(400).json({
            error: 'Some person_ids are not active members of the group in your organization',
            invalid_ids: invalidPersonIds,
          });
          return;
        }

        const inputs = records.map((r: { person_id: string; presence_status: string }) => ({
          organizationId: req.organizationId!,
          personId: r.person_id,
          date,
          presenceStatus: r.presence_status,
          recordedBy: req.user!.user_id,
        }));

        const savedRecords = await bulkRecordAttendance(inputs);

        // Audit log: per-student bulk attendance recorded
        void logAudit({
          organization_id: req.organizationId,
          user_id: req.user!.user_id,
          action: 'CREATE',
          entity_type: 'attendance',
          details: { group_id, date, mode: 'per_student', count: savedRecords.length },
          ip_address: req.ip,
        });

        res.status(201).json({
          message: 'Bulk attendance recorded',
          count: savedRecords.length,
          records: savedRecords,
        });
        return;
      }

      // ── Whole-group single-status mode (backward compatible) ──────────────
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

      const savedRecords = await bulkRecordAttendance(inputs);

      // Audit log: bulk attendance recorded
      void logAudit({
        organization_id: req.organizationId,
        user_id: req.user!.user_id,
        action: 'CREATE',
        entity_type: 'attendance',
        details: { group_id, date, presence_status, count: savedRecords.length },
        ip_address: req.ip,
      });

      res.status(201).json({
        message: 'Bulk attendance recorded',
        count: savedRecords.length,
        records: savedRecords,
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
    const { person_id, date, presence_status, subject_id, period_label } = req.body;

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
        subjectId: subject_id || undefined,
        periodLabel: period_label || 'Full Day',
      });

      // Audit log: single attendance recorded
      void logAudit({
        organization_id: req.organizationId,
        user_id: req.user!.user_id,
        action: 'CREATE',
        entity_type: 'attendance',
        entity_id: record.id,
        details: { person_id, date, presence_status },
        ip_address: req.ip,
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

/**
 * GET /dashboard — Admin dashboard summary for a single date (defaults to today).
 * Tenant-isolated. Returns total students, per-status counts and percentages,
 * pending leave request count, and the number of groups not yet marked.
 * Query: date (optional, YYYY-MM-DD)
 *
 * IMPORTANT: Registered before the /:personId/* param routes to avoid capture.
 */
router.get(
  '/dashboard',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { date } = req.query;

    // Validate date format if provided; otherwise default to today.
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (date && !dateRegex.test(date as string)) {
      res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
      return;
    }

    let targetDate: string;
    if (date) {
      targetDate = date as string;
    } else {
      const now = new Date();
      targetDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    try {
      const organizationId = req.organizationId!;

      // Total active students in the organization
      const [{ count: totalCount }] = await db('persons')
        .where('organization_id', organizationId)
        .where('is_active', true)
        .count('id as count');
      const total_students = parseInt(totalCount as string, 10);

      // Per-status counts for the target date
      const statusRows = await db('attendance_records')
        .where('organization_id', organizationId)
        .where('date', targetDate)
        .select('presence_status')
        .count('id as count')
        .groupBy('presence_status');

      const statusCounts: Record<string, number> = {};
      for (const row of statusRows) {
        statusCounts[row.presence_status as string] = parseInt(row.count as string, 10);
      }

      const present = statusCounts['Present'] || 0;
      const absent = statusCounts['Absent'] || 0;
      const late = statusCounts['Late'] || 0;
      const on_leave = statusCounts['On_Leave'] || 0;

      const pct = (value: number): number =>
        total_students > 0 ? Math.round((value / total_students) * 1000) / 10 : 0;

      // Pending leave requests for the organization
      const [{ count: pendingCount }] = await db('leave_requests')
        .where('organization_id', organizationId)
        .where('status', 'Pending')
        .count('id as count');
      const pending_leave_requests = parseInt(pendingCount as string, 10);

      // Total groups in the organization
      const [{ count: groupCount }] = await db('groups')
        .where('organization_id', organizationId)
        .count('id as count');
      const total_groups = parseInt(groupCount as string, 10);

      // Distinct groups that have at least one attendance record on the date
      const markedGroups = await db('attendance_records')
        .join('person_groups', 'attendance_records.person_id', 'person_groups.person_id')
        .join('groups', 'person_groups.group_id', 'groups.id')
        .where('attendance_records.organization_id', organizationId)
        .where('groups.organization_id', organizationId)
        .where('attendance_records.date', targetDate)
        .distinct('person_groups.group_id');
      const groups_marked = markedGroups.length;
      const groups_not_marked = Math.max(0, total_groups - groups_marked);

      res.status(200).json({
        date: targetDate,
        total_students,
        present,
        absent,
        late,
        on_leave,
        present_percentage: pct(present),
        absent_percentage: pct(absent),
        late_percentage: pct(late),
        on_leave_percentage: pct(on_leave),
        pending_leave_requests,
        groups_not_marked,
      });
    } catch (error) {
      throw error;
    }
  }
);

/**
 * GET /marked-dates — Get dates that have attendance records for a class in a given month.
 * Query: group_id, year, month
 */
router.get(
  '/marked-dates',
  authenticate,
  tenantIsolation,
  authorize('Admin', 'Teacher'),
  async (req: Request, res: Response): Promise<void> => {
    const { group_id, year, month } = req.query;
    if (!group_id || !year || !month) {
      res.status(400).json({ error: 'group_id, year, and month are required' });
      return;
    }

    // For Teacher role: validate they are assigned to the requested group
    if (req.user!.role === 'Teacher') {
      const assigned = await isAssignedToGroup(req.user!.user_id, group_id as string);
      if (!assigned) {
        res.status(403).json({ error: 'Forbidden: you are not assigned to this group' });
        return;
      }
    }

    const startDate = `${year}-${String(Number(month)).padStart(2, '0')}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${String(Number(month)).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const dates = await db('attendance_records')
      .join('person_groups', 'attendance_records.person_id', 'person_groups.person_id')
      .where('person_groups.group_id', group_id as string)
      .where('attendance_records.organization_id', req.organizationId)
      .whereBetween('attendance_records.date', [startDate, endDate])
      .select('attendance_records.date')
      .distinct();

    res.json({ marked_dates: dates.map(d => d.date) });
  }
);

export default router;
