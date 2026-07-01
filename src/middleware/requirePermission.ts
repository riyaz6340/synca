import { Request, Response, NextFunction, RequestHandler } from 'express';
import { hasPermission } from '../services/permissionService';

/**
 * Granular permission middleware factory.
 * For Admin/SuperAdmin: always passes (full access).
 * For Teacher: checks if the user has the required permission.
 * Returns 403 with the specific missing permission name if denied.
 *
 * Must be used after the authenticate middleware (which sets req.user).
 *
 * @param permission - The permission string required to access the endpoint
 * @returns Express middleware function
 */
export function requirePermission(permission: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { role, user_id, organization_id } = req.user;

    // Admin and SuperAdmin have full access — bypass permission checks
    if (role === 'Admin' || role === 'SuperAdmin') {
      next();
      return;
    }

    // For Teacher role: check granular permission
    try {
      const permitted = await hasPermission(user_id, organization_id, permission);

      if (!permitted) {
        res.status(403).json({ error: `Forbidden: missing permission '${permission}'` });
        return;
      }

      next();
    } catch {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}
