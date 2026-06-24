import { Router, Request, Response } from 'express';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { UserModel } from '../models/User';
import { addToBlacklist } from '../utils/tokenBlacklist';
import db from '../config/database';

const router = Router();

const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET environment variable is required'); })();
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as StringValue;

/**
 * GET /organizations
 * Public endpoint — returns list of organization names for the login dropdown.
 * Only returns id and name (no sensitive data).
 * Supports optional ?search= query param for filtering.
 */
router.get('/organizations', async (req: Request, res: Response): Promise<void> => {
  const { search } = req.query;

  let query = db('organizations')
    .select('id', 'name')
    .orderBy('name', 'asc');

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const sanitizedSearch = search.trim().replace(/[%_]/g, '');
    query = query.whereILike('name', `%${sanitizedSearch}%`);
  }

  const organizations = await query.limit(50);
  res.json({ organizations });
});

interface TokenPayload extends JwtPayload {
  user_id: string;
  organization_id: string;
  role: string;
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password, organization_id, organization_name } = req.body;

  // Validate required fields
  if (!email || !password) {
    res.status(400).json({
      error: 'Missing required fields: email and password are required',
    });
    return;
  }

  if (!organization_id && !organization_name) {
    res.status(400).json({
      error: 'Missing required field: organization_name or organization_id is required',
    });
    return;
  }

  // Resolve organization_id from name if needed
  let resolvedOrgId = organization_id;
  if (!resolvedOrgId && organization_name) {
    const db = (await import('../config/database')).default;
    const org = await db('organizations')
      .whereILike('name', organization_name.trim())
      .first();
    if (!org) {
      res.status(401).json({ error: 'Organization not found' });
      return;
    }
    resolvedOrgId = org.id;
  }

  // Look up user by email scoped to organization
  const user = await UserModel.findByEmail(email, resolvedOrgId);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Verify password
  const isValidPassword = await UserModel.verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Sign JWT with user payload
  const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN };
  const token = jwt.sign(
    {
      user_id: user.id,
      organization_id: user.organization_id,
      role: user.role,
    },
    JWT_SECRET,
    signOptions
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
    },
  });
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.body;

  if (!token) {
    res.status(400).json({ error: 'Missing required field: token' });
    return;
  }

  try {
    // Verify and decode the existing token
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    // Verify the user still exists and re-read current role/org from DB
    const user = await UserModel.findById(decoded.user_id);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Issue a new JWT with fresh data from DB (role/org may have changed)
    const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN };
    const newToken = jwt.sign(
      {
        user_id: user.id,
        organization_id: user.organization_id,
        role: user.role,
      },
      JWT_SECRET,
      signOptions
    );

    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  // Accept token from body or Authorization header
  let token: string | undefined = req.body?.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    res.status(400).json({ error: 'Missing required field: token (provide in body or Authorization header)' });
    return;
  }

  addToBlacklist(token);

  res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
