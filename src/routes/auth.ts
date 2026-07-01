import { Router, Request, Response } from 'express';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { UserModel } from '../models/User';
import { addToBlacklist } from '../utils/tokenBlacklist';
import db from '../config/database';
import { authenticate } from '../middleware/authenticate';
import { logAudit } from '../utils/auditLog';

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

  // Resolve organization name and branding metadata for the response
  const organization = await db('organizations')
    .select('name', 'metadata')
    .where({ id: user.organization_id })
    .first();

  // Audit log: successful login
  void logAudit({
    organization_id: user.organization_id,
    user_id: user.id,
    action: 'LOGIN',
    entity_type: 'user',
    entity_id: user.id,
    ip_address: req.ip,
  });

  const responseUser: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id,
  };

  // Include organization_name and branding fields if the organization record was found
  if (organization) {
    responseUser.organization_name = organization.name;
    const meta = typeof organization.metadata === 'string'
      ? JSON.parse(organization.metadata)
      : organization.metadata ?? {};
    responseUser.logo_url = meta.logo_url ?? null;
    responseUser.primary_color = meta.primary_color ?? null;
  } else {
    responseUser.logo_url = null;
    responseUser.primary_color = null;
  }

  res.json({
    token,
    user: responseUser,
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

  // Audit log: logout (extract user_id from token if possible)
  try {
    const decoded = jwt.decode(token) as TokenPayload | null;
    if (decoded) {
      void logAudit({
        organization_id: decoded.organization_id,
        user_id: decoded.user_id,
        action: 'LOGOUT',
        entity_type: 'user',
        entity_id: decoded.user_id,
        ip_address: req.ip,
      });
    }
  } catch { /* ignore decode errors */ }

  res.status(200).json({ message: 'Logged out successfully' });
});

// POST /change-password - Change own password (authenticated)
router.post('/change-password', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  if (new_password.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters' });
    return;
  }

  const user = await UserModel.findById(req.user!.user_id);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const isValid = await UserModel.verifyPassword(current_password, user.password_hash);
  if (!isValid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const bcrypt = await import('bcrypt');
  const newHash = await bcrypt.hash(new_password, 12);
  await db('users').where({ id: req.user!.user_id }).update({ password_hash: newHash, updated_at: new Date() });

  // Audit log: password change
  void logAudit({
    organization_id: user.organization_id,
    user_id: user.id,
    action: 'PASSWORD_CHANGE',
    entity_type: 'user',
    entity_id: user.id,
    ip_address: req.ip,
  });

  res.json({ message: 'Password changed successfully' });
});

export default router;
