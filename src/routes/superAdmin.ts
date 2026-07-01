import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import db from '../config/database';
import bcrypt from 'bcrypt';
import {
  getDailyActiveUsers,
  getWeeklyActiveUsers,
  getMonthlyActiveUsers,
  getYearlyActiveUsers,
} from '../services/activityEventService';

const router = Router();
const SALT_ROUNDS = 12;

/**
 * Middleware: Only SuperAdmin users can access these routes.
 * SuperAdmin is NOT scoped to any organization — they see everything.
 */
function requireSuperAdmin(req: Request, res: Response, next: () => void): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'SuperAdmin') {
    res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
    return;
  }
  next();
}

// All routes require SuperAdmin authentication
router.use(authenticate, requireSuperAdmin);

/**
 * GET /dashboard
 * Returns platform-wide statistics for the founder.
 */
router.get('/dashboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Total organizations
    const [{ count: totalOrgs }] = await db('organizations').count('id as count');

    // Total persons (students) across all orgs
    const [{ count: totalPersons }] = await db('persons').where('is_active', true).count('id as count');

    // Total users
    const [{ count: totalUsers }] = await db('users').count('id as count');

    // Total attendance records
    const [{ count: totalAttendanceRecords }] = await db('attendance_records').count('id as count');

    // Organizations by plan
    const planBreakdown = await db('organizations')
      .select('plan')
      .count('id as count')
      .groupBy('plan')
      .orderBy('count', 'desc');

    // Organizations by industry module
    const industryBreakdown = await db('organizations')
      .select('industry_module')
      .count('id as count')
      .groupBy('industry_module')
      .orderBy('count', 'desc');

    // Organizations by billing status
    const billingBreakdown = await db('organizations')
      .select('billing_status')
      .count('id as count')
      .groupBy('billing_status')
      .orderBy('count', 'desc');

    // Total monthly revenue (sum of monthly_amount for active orgs)
    const [{ total: monthlyRevenue }] = await db('organizations')
      .where('billing_status', 'active')
      .sum('monthly_amount as total');

    // Recent organizations (last 10 signups)
    const recentOrgs = await db('organizations')
      .select('id', 'name', 'industry_module', 'plan', 'monthly_amount', 'billing_status', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(10);

    // Persons count per organization (top 20)
    const orgPersonCounts = await db('persons')
      .join('organizations', 'persons.organization_id', 'organizations.id')
      .select(
        'organizations.id as org_id',
        'organizations.name as org_name',
        'organizations.plan',
        'organizations.monthly_amount',
        'organizations.billing_status'
      )
      .where('persons.is_active', true)
      .count('persons.id as person_count')
      .groupBy('organizations.id', 'organizations.name', 'organizations.plan', 'organizations.monthly_amount', 'organizations.billing_status')
      .orderBy('person_count', 'desc')
      .limit(20);

    // Today's platform-wide attendance
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = await db('attendance_records')
      .where('date', today)
      .select('presence_status')
      .count('id as count')
      .groupBy('presence_status');

    res.json({
      overview: {
        total_organizations: parseInt(totalOrgs as string, 10),
        total_persons: parseInt(totalPersons as string, 10),
        total_users: parseInt(totalUsers as string, 10),
        total_attendance_records: parseInt(totalAttendanceRecords as string, 10),
        monthly_revenue: parseFloat(monthlyRevenue as string) || 0,
      },
      plan_breakdown: planBreakdown.map(r => ({
        plan: r.plan,
        count: parseInt(r.count as string, 10),
      })),
      industry_breakdown: industryBreakdown.map(r => ({
        industry_module: r.industry_module,
        count: parseInt(r.count as string, 10),
      })),
      billing_breakdown: billingBreakdown.map(r => ({
        billing_status: r.billing_status,
        count: parseInt(r.count as string, 10),
      })),
      today_attendance: todayAttendance.map(r => ({
        presence_status: r.presence_status,
        count: parseInt(r.count as string, 10),
      })),
      recent_organizations: recentOrgs,
      organizations_by_size: orgPersonCounts.map(r => ({
        ...r,
        person_count: parseInt(r.person_count as string, 10),
      })),
    });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /organizations
 * Returns all organizations with their details, plan, and person counts.
 */
router.get('/organizations', async (req: Request, res: Response): Promise<void> => {
  const { page, limit, plan, billing_status, search } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  try {
    let baseQuery = db('organizations');

    // Filter by plan
    if (plan && typeof plan === 'string') {
      baseQuery = baseQuery.where('plan', plan);
    }

    // Filter by billing status
    if (billing_status && typeof billing_status === 'string') {
      baseQuery = baseQuery.where('billing_status', billing_status);
    }

    // Search by name
    if (search && typeof search === 'string') {
      const sanitizedSearch = search.replace(/[%_]/g, '');
      baseQuery = baseQuery.whereILike('name', `%${sanitizedSearch}%`);
    }

    // Total count
    const [{ count }] = await baseQuery.clone().count('id as count');
    const total = parseInt(count as string, 10);
    const totalPages = Math.ceil(total / limitNum);

    // Fetch organizations with person count
    const organizations = await baseQuery
      .clone()
      .select(
        'organizations.id',
        'organizations.name',
        'organizations.industry_module',
        'organizations.plan',
        'organizations.monthly_amount',
        'organizations.billing_status',
        'organizations.trial_ends_at',
        'organizations.subscription_started_at',
        'organizations.created_at'
      )
      .orderBy('organizations.created_at', 'desc')
      .limit(limitNum)
      .offset(offset);

    // Get person counts for these organizations
    const orgIds = organizations.map(o => o.id);
    const personCounts = orgIds.length > 0
      ? await db('persons')
          .whereIn('organization_id', orgIds)
          .where('is_active', true)
          .select('organization_id')
          .count('id as count')
          .groupBy('organization_id')
      : [];

    const countMap = Object.fromEntries(
      personCounts.map(pc => [pc.organization_id, parseInt(pc.count as string, 10)])
    );

    const orgsWithCounts = organizations.map(org => ({
      ...org,
      person_count: countMap[org.id] || 0,
    }));

    res.json({
      data: orgsWithCounts,
      pagination: { page: pageNum, limit: limitNum, total, totalPages },
    });
  } catch (error) {
    throw error;
  }
});

/**
 * PUT /organizations/:id/plan
 * Update an organization's plan and billing details.
 */
router.put('/organizations/:id/plan', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { plan, monthly_amount, billing_status } = req.body;

  try {
    const org = await db('organizations').where('id', id).first();
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (plan !== undefined) updates.plan = plan;
    if (monthly_amount !== undefined) updates.monthly_amount = monthly_amount;
    if (billing_status !== undefined) updates.billing_status = billing_status;

    // If changing to active and no subscription start date, set it
    if (billing_status === 'active' && !org.subscription_started_at) {
      updates.subscription_started_at = new Date();
    }

    const [updated] = await db('organizations')
      .where('id', id)
      .update(updates)
      .returning('*');

    res.json({ organization: updated });
  } catch (error) {
    throw error;
  }
});

/**
 * PUT /organizations/:id
 * Update an organization's general details (name, industry module) along with
 * its plan/billing fields. Partial update — only fields present in the body
 * are applied. (Requirement 19.5)
 */
router.put('/organizations/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, industry_module, plan, monthly_amount, billing_status } = req.body;

  try {
    const org = await db('organizations').where('id', id).first();
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (name !== undefined) updates.name = name;
    if (industry_module !== undefined) updates.industry_module = industry_module;
    if (plan !== undefined) updates.plan = plan;
    if (monthly_amount !== undefined) updates.monthly_amount = monthly_amount;
    if (billing_status !== undefined) updates.billing_status = billing_status;

    // If changing to active and no subscription start date, set it
    if (billing_status === 'active' && !org.subscription_started_at) {
      updates.subscription_started_at = new Date();
    }

    const [updated] = await db('organizations')
      .where('id', id)
      .update(updates)
      .returning('*');

    res.json({ organization: updated });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(400).json({ error: 'An organization with this name already exists' });
      return;
    }
    throw error;
  }
});

/**
 * GET /organizations/:id
 * Get detailed info about a specific organization.
 */
router.get('/organizations/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const org = await db('organizations').where('id', id).first();
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Get counts
    const [{ count: personCount }] = await db('persons')
      .where('organization_id', id).where('is_active', true).count('id as count');
    const [{ count: userCount }] = await db('users')
      .where('organization_id', id).count('id as count');
    const [{ count: groupCount }] = await db('groups')
      .where('organization_id', id).count('id as count');
    const [{ count: attendanceCount }] = await db('attendance_records')
      .where('organization_id', id).count('id as count');

    res.json({
      organization: org,
      stats: {
        persons: parseInt(personCount as string, 10),
        users: parseInt(userCount as string, 10),
        groups: parseInt(groupCount as string, 10),
        attendance_records: parseInt(attendanceCount as string, 10),
      },
    });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /organizations
 * Onboard a new organization with its admin user in one step.
 * Body: { name, industry_module, plan, admin_email, admin_password }
 */
router.post('/organizations', async (req: Request, res: Response): Promise<void> => {
  const { name, industry_module, plan, admin_email, admin_password } = req.body;

  // Validate required fields
  if (!name || !admin_email || !admin_password) {
    res.status(400).json({ error: 'name, admin_email, and admin_password are required' });
    return;
  }

  try {
    const result = await db.transaction(async (trx) => {
      // Create the organization
      const [org] = await trx('organizations')
        .insert({
          name: name.trim(),
          industry_module: industry_module || 'school',
          plan: plan || 'free',
          billing_status: 'trial',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
          metadata: JSON.stringify({}),
        })
        .returning('*');

      // Create the admin user
      const passwordHash = await bcrypt.hash(admin_password, SALT_ROUNDS);
      const [adminUser] = await trx('users')
        .insert({
          organization_id: org.id,
          email: admin_email.trim().toLowerCase(),
          password_hash: passwordHash,
          role: 'Admin',
        })
        .returning(['id', 'email', 'role', 'organization_id', 'created_at']);

      return { organization: org, admin_user: adminUser };
    });

    res.status(201).json(result);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(400).json({ error: 'An organization with this name or admin email already exists' });
      return;
    }
    throw error;
  }
});

/**
 * GET /analytics
 * Returns DAU/WAU/MAU/YAU for the current period or a custom date range.
 * Query params:
 *   - date: YYYY-MM-DD (defaults to today)
 *   - start_date: YYYY-MM-DD (optional, for custom range)
 *   - end_date: YYYY-MM-DD (optional, for custom range)
 *   - organization_id: UUID (optional filter)
 */
router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, start_date, end_date, organization_id } = req.query;

    // Date range validation
    if (start_date && end_date) {
      const start = new Date(start_date as string);
      const end = new Date(end_date as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({ error: 'Invalid date range: dates must be valid YYYY-MM-DD format' });
        return;
      }

      if (end < start) {
        res.status(400).json({ error: 'Invalid date range: end date must be greater than or equal to start date' });
        return;
      }

      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 365) {
        res.status(400).json({ error: 'Invalid date range: span must not exceed 365 days' });
        return;
      }
    }

    // Determine the reference date
    const referenceDate = (date as string) || (end_date as string) || new Date().toISOString().split('T')[0];
    const refDateObj = new Date(referenceDate);

    if (isNaN(refDateObj.getTime())) {
      res.status(400).json({ error: 'Invalid date range: date must be valid YYYY-MM-DD format' });
      return;
    }

    const orgFilter = organization_id as string | undefined;

    const year = refDateObj.getUTCFullYear();
    const month = refDateObj.getUTCMonth() + 1;

    const [dau, wau, mau, yau] = await Promise.all([
      getDailyActiveUsers(referenceDate, orgFilter),
      getWeeklyActiveUsers(referenceDate, orgFilter),
      getMonthlyActiveUsers(year, month, orgFilter),
      getYearlyActiveUsers(year, orgFilter),
    ]);

    res.json({
      date: referenceDate,
      organization_id: orgFilter || null,
      metrics: { dau, wau, mau, yau },
    });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /analytics/trend
 * Returns 30-day DAU trend (one data point per day), ending today.
 * Query params:
 *   - organization_id: UUID (optional filter)
 */
router.get('/analytics/trend', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organization_id } = req.query;
    const orgFilter = organization_id as string | undefined;

    const today = new Date();
    const trend: Array<{ date: string; count: number }> = [];

    // Generate dates for the last 30 days (including today)
    const promises: Array<Promise<number>> = [];
    const dates: string[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dates.push(dateStr);
      promises.push(getDailyActiveUsers(dateStr, orgFilter));
    }

    const counts = await Promise.all(promises);

    for (let i = 0; i < dates.length; i++) {
      trend.push({ date: dates[i], count: counts[i] });
    }

    res.json({
      organization_id: orgFilter || null,
      period: {
        start: dates[0],
        end: dates[dates.length - 1],
      },
      trend,
    });
  } catch (error) {
    throw error;
  }
});

export default router;
