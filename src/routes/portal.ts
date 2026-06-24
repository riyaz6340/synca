import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';

const router = Router();

// All portal routes require Stakeholder authentication
router.use(authenticate, tenantIsolation, authorize('Stakeholder'));

/**
 * GET /persons
 * List all Persons associated with the authenticated Stakeholder,
 * including their current Presence_Status (today's attendance record).
 */
router.get('/persons', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.user_id;
    const organizationId = req.organizationId!;

    // Find the stakeholder record for this user
    const stakeholder = await db('stakeholders')
      .where('user_id', userId)
      .where('organization_id', organizationId)
      .first();

    if (!stakeholder) {
      res.status(200).json({ persons: [] });
      return;
    }

    // Get all persons linked via person_stakeholders
    const persons = await db('persons')
      .join('person_stakeholders', 'persons.id', 'person_stakeholders.person_id')
      .where('person_stakeholders.stakeholder_id', stakeholder.id)
      .where('persons.organization_id', organizationId)
      .select(
        'persons.id',
        'persons.name',
        'persons.contact_info',
        'persons.metadata',
        'persons.is_active',
        'persons.created_at',
        'persons.updated_at',
        'person_stakeholders.relationship'
      );

    // Get today's attendance records for all associated persons
    // Use local date to avoid timezone issues
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const personIds = persons.map((p) => p.id);

    const todayRecords = personIds.length > 0
      ? await db('attendance_records')
          .whereIn('person_id', personIds)
          .where('organization_id', organizationId)
          .where('date', today)
          .select('person_id', 'presence_status', 'time')
      : [];

    // Map attendance records by person_id for quick lookup
    const attendanceMap = new Map<string, { presence_status: string; time: string }>();
    for (const record of todayRecords) {
      attendanceMap.set(record.person_id, {
        presence_status: record.presence_status,
        time: record.time,
      });
    }

    // Build response with current_status
    const personsWithStatus = persons.map((person) => {
      const attendance = attendanceMap.get(person.id);
      return {
        ...person,
        current_status: attendance
          ? { presence_status: attendance.presence_status, time: attendance.time }
          : null,
      };
    });

    res.status(200).json({ persons: personsWithStatus });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /persons/:id/attendance
 * Get attendance history for an associated Person with date range filtering.
 * Returns 403 if the person is not associated with the authenticated stakeholder.
 */
router.get('/persons/:id/attendance', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { start_date, end_date } = req.query;

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
    const userId = req.user!.user_id;
    const organizationId = req.organizationId!;

    // Find the stakeholder record for this user
    const stakeholder = await db('stakeholders')
      .where('user_id', userId)
      .where('organization_id', organizationId)
      .first();

    if (!stakeholder) {
      res.status(403).json({ error: 'Forbidden: person is not associated with your account' });
      return;
    }

    // Verify the person is associated with this stakeholder
    const association = await db('person_stakeholders')
      .where('person_id', id)
      .where('stakeholder_id', stakeholder.id)
      .first();

    if (!association) {
      res.status(403).json({ error: 'Forbidden: person is not associated with your account' });
      return;
    }

    // Build attendance query
    let query = db('attendance_records')
      .where('person_id', id)
      .where('organization_id', organizationId);

    if (start_date) {
      query = query.where('date', '>=', start_date as string);
    }
    if (end_date) {
      query = query.where('date', '<=', end_date as string);
    }

    const records = await query
      .select('id', 'date', 'time', 'presence_status', 'created_at')
      .orderBy('date', 'desc');

    // Format date as YYYY-MM-DD string to avoid timezone conversion issues
    const formattedRecords = records.map((r: { date: Date | string; [key: string]: unknown }) => ({
      ...r,
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
    }));

    res.status(200).json({ attendance: formattedRecords });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /notifications
 * List Stakeholder's notifications in reverse chronological order with pagination.
 */
router.get('/notifications', async (req: Request, res: Response): Promise<void> => {
  const { page, limit } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  try {
    const userId = req.user!.user_id;
    const organizationId = req.organizationId!;

    // Find the stakeholder record for this user
    const stakeholder = await db('stakeholders')
      .where('user_id', userId)
      .where('organization_id', organizationId)
      .first();

    if (!stakeholder) {
      res.status(200).json({
        data: [],
        pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 },
      });
      return;
    }

    const baseQuery = db('notifications')
      .where('organization_id', organizationId)
      .where('stakeholder_id', stakeholder.id);

    // Get total count for pagination
    const [{ count }] = await baseQuery.clone().count('* as count');
    const total = parseInt(count as string, 10);
    const totalPages = Math.ceil(total / limitNum);

    // Fetch paginated records
    const records = await baseQuery
      .clone()
      .select(
        'id',
        'type',
        'title',
        'body',
        'channel_used',
        'delivery_status',
        'sent_at',
        'created_at'
      )
      .orderBy('created_at', 'desc')
      .limit(limitNum)
      .offset(offset);

    res.status(200).json({
      data: records,
      pagination: { page: pageNum, limit: limitNum, total, totalPages },
    });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /announcements
 * List Announcements relevant to the Stakeholder's associated Persons and Groups.
 * Returns published announcements where:
 * - target_type = 'Organization' (org-wide)
 * - OR target_type = 'Group' AND target_ids overlaps with person's group_ids
 * - OR target_type = 'Person' AND target_ids overlaps with person_ids
 */
router.get('/announcements', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.user_id;
    const organizationId = req.organizationId!;

    // Find the stakeholder record for this user
    const stakeholder = await db('stakeholders')
      .where('user_id', userId)
      .where('organization_id', organizationId)
      .first();

    if (!stakeholder) {
      res.status(200).json({ announcements: [] });
      return;
    }

    // Get all person IDs associated with this stakeholder
    const personLinks = await db('person_stakeholders')
      .where('stakeholder_id', stakeholder.id)
      .select('person_id');

    const personIds = personLinks.map((link) => link.person_id);

    if (personIds.length === 0) {
      // Stakeholder has no persons, only org-wide announcements apply
      const orgAnnouncements = await db('announcements')
        .where('organization_id', organizationId)
        .whereNotNull('published_at')
        .where('target_type', 'Organization')
        .select('*')
        .orderBy('published_at', 'desc');

      res.status(200).json({ announcements: orgAnnouncements });
      return;
    }

    // Get all group IDs for the associated persons
    const groupLinks = await db('person_groups')
      .whereIn('person_id', personIds)
      .select('group_id');

    const groupIds = groupLinks.map((link) => link.group_id);

    // Query published announcements that are relevant
    const announcements = await db('announcements')
      .where('organization_id', organizationId)
      .whereNotNull('published_at')
      .where(function () {
        // Org-wide announcements
        this.where('target_type', 'Organization');

        // Group-targeted announcements where target_ids overlaps with person's groups
        if (groupIds.length > 0) {
          this.orWhere(function () {
            this.where('target_type', 'Group')
              .whereRaw('target_ids && ?', [
                `{${groupIds.join(',')}}`,
              ]);
          });
        }

        // Person-targeted announcements where target_ids overlaps with person_ids
        this.orWhere(function () {
          this.where('target_type', 'Person')
            .whereRaw('target_ids && ?', [
              `{${personIds.join(',')}}`,
            ]);
        });
      })
      .select('*')
      .orderBy('published_at', 'desc');

    res.status(200).json({ announcements });
  } catch (error) {
    throw error;
  }
});

export default router;
