import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import organizationRouter from './routes/organization';
import personsRouter from './routes/persons';
import groupsRouter from './routes/groups';
import attendanceRouter from './routes/attendance';
import notificationsRouter from './routes/notifications';
import leaveRequestsRouter from './routes/leaveRequests';
import announcementsRouter from './routes/announcements';
import reportsRouter from './routes/reports';
import portalRouter from './routes/portal';
import channelsRouter from './routes/channels';
import superAdminRouter from './routes/superAdmin';
import holidaysRouter from './routes/holidays';
import pushRouter from './routes/push';
import subjectsRouter from './routes/subjects';
import { authRateLimiter } from './middleware/rateLimiter';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Trust proxy (required for Render/Railway/Heroku — they use reverse proxies)
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (public - no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// One-time setup endpoint — seeds the database with initial data
// Remove this after first use in production for security
app.get('/api/setup-seed', async (_req, res) => {
  try {
    const bcrypt = await import('bcrypt');
    const db = (await import('./config/database')).default;

    // Check if already seeded
    const existingOrg = await db('organizations').where('name', 'Demo School').first();
    if (existingOrg) {
      res.json({ message: 'Already seeded', org_id: existingOrg.id });
      return;
    }

    // Create Demo School
    const [org] = await db('organizations').insert({ name: 'Demo School', industry_module: 'school', metadata: '{}' }).returning('*');

    // Create Admin
    const adminHash = await bcrypt.hash('Admin@123456', 12);
    const [admin] = await db('users').insert({ organization_id: org.id, email: 'admin@demo.school', password_hash: adminHash, role: 'Admin' }).returning('*');

    // Create Avento Platform org + SuperAdmin
    const [platformOrg] = await db('organizations').insert({ name: 'Avento Platform', industry_module: 'platform', metadata: '{}' }).returning('*');
    const founderHash = await bcrypt.hash('Founder@2024', 12);
    await db('users').insert({ organization_id: platformOrg.id, email: 'founder@avento.app', password_hash: founderHash, role: 'SuperAdmin' });

    res.json({
      message: 'Database seeded successfully!',
      admin: { email: 'admin@demo.school', password: 'Admin@123456', org: org.name, org_id: org.id },
      founder: { email: 'founder@avento.app', password: 'Founder@2024', org: 'Avento Platform' },
      admin_user_id: admin.id,
    });
  } catch (error) {
    res.status(500).json({ error: 'Seed failed', details: (error as Error).message });
  }
});

// Routes
app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api/organization', organizationRouter);
app.use('/api/persons', personsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/leave-requests', leaveRequestsRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/portal', portalRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/super-admin', superAdminRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/push', pushRouter);
app.use('/api/subjects', subjectsRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message, err.stack);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { message: err.message }),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Avento Platform server running on port ${PORT}`);
});

export default app;
