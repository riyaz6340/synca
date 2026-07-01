import { Request, Response, NextFunction } from 'express';
import db from '../config/database';

/**
 * Routes that should be excluded from activity tracking.
 * Health-check endpoints and static asset paths are not user actions.
 */
const EXCLUDED_PATHS = [
  '/api/health',
  '/api/ping',
  '/health',
  '/ping',
];

/**
 * Path prefixes for static assets that should be excluded from tracking.
 */
const EXCLUDED_PATH_PREFIXES = [
  '/static/',
  '/assets/',
  '/public/',
  '/favicon',
];

/**
 * Roles/identifiers for service accounts and background processes
 * that should not generate activity events.
 */
const EXCLUDED_ROLES = [
  'ServiceAccount',
  'BackgroundProcess',
  'System',
];

/**
 * Determines whether a request should be excluded from activity tracking.
 */
function isExcludedRoute(path: string): boolean {
  const normalizedPath = path.toLowerCase();

  if (EXCLUDED_PATHS.some((excluded) => normalizedPath === excluded)) {
    return true;
  }

  if (EXCLUDED_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return true;
  }

  return false;
}

/**
 * Determines whether a user should be excluded from activity tracking.
 * Service accounts and background processes are excluded.
 */
function isExcludedUser(user: { role: string; user_id: string }): boolean {
  if (EXCLUDED_ROLES.includes(user.role)) {
    return true;
  }

  return false;
}

/**
 * Derives the action type from the HTTP method and path.
 */
function deriveActionType(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/**
 * Express middleware that asynchronously records an Activity_Event
 * for each authenticated request, excluding health-check and static routes.
 *
 * Uses fire-and-forget pattern: the DB insert runs asynchronously and
 * recording failures are caught silently (logged to stderr) without
 * blocking or failing the original API response.
 *
 * Must be used AFTER the authenticate middleware (which sets req.user).
 */
export function activityTracker(req: Request, res: Response, next: NextFunction): void {
  // Call next() immediately — never block the request
  next();

  // Only track authenticated requests
  if (!req.user) {
    return;
  }

  // Exclude health-check and static asset routes
  if (isExcludedRoute(req.path)) {
    return;
  }

  // Exclude service accounts and background processes
  if (isExcludedUser(req.user)) {
    return;
  }

  const { user_id, organization_id } = req.user;
  const actionType = deriveActionType(req.method, req.path);
  const endpoint = req.originalUrl || req.path;

  // Fire-and-forget: insert asynchronously, catch errors silently
  db('user_activity_events')
    .insert({
      user_id,
      organization_id,
      action_type: actionType.substring(0, 100),
      endpoint: endpoint.substring(0, 255),
    })
    .then(() => {
      // Successfully recorded — no action needed
    })
    .catch((error: Error) => {
      // Log to stderr but don't throw or affect the response
      console.error('[ActivityTracker] Failed to record activity event:', error.message);
    });
}

export default activityTracker;
