import { Request, Response, NextFunction } from 'express';

/**
 * Tenant isolation middleware.
 * Extracts organization_id from the authenticated user (set by authenticate middleware)
 * and attaches it to req.organizationId for easy access by route handlers.
 *
 * This ensures every downstream handler has the tenant context available
 * for scoping database queries with WHERE organization_id = req.organizationId.
 *
 * Must be used AFTER the authenticate middleware in the middleware chain.
 */
export function tenantIsolation(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.organization_id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  req.organizationId = req.user.organization_id;
  next();
}
