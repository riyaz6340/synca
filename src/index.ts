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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (public - no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
