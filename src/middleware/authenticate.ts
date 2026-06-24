import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isBlacklisted } from '../utils/tokenBlacklist';

const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET environment variable is required'); })();

interface TokenPayload {
  user_id: string;
  organization_id: string;
  role: string;
}

/**
 * JWT authentication middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * checks against blacklist, and attaches decoded user info to request.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  if (isBlacklisted(token)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    req.user = {
      user_id: decoded.user_id,
      organization_id: decoded.organization_id,
      role: decoded.role,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
