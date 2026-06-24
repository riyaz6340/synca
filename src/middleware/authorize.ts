import { Request, Response, NextFunction } from 'express';

/**
 * Role-based authorization middleware factory.
 * Returns a middleware that checks if the authenticated user's role
 * is included in the list of allowed roles for the endpoint.
 *
 * Must be used after the authenticate middleware (which sets req.user).
 *
 * @param allowedRoles - One or more roles permitted to access the endpoint
 * @returns Express middleware function
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      return;
    }

    next();
  };
}
