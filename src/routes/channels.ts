import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';

const router = Router();

// ---------- Supported channel types ----------
const VALID_CHANNEL_TYPES = ['sms', 'whatsapp', 'email', 'push'];

// =============================================================================
// Organization-level channel settings (Tasks 12.1 + 12.2)
// =============================================================================

/**
 * GET /organization
 * Returns the organization's channel credential configuration from metadata.channels
 */
router.get(
  '/organization',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const organization = await db('organizations')
      .where({ id: req.organizationId })
      .first();

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const metadata =
      typeof organization.metadata === 'string'
        ? JSON.parse(organization.metadata)
        : organization.metadata || {};

    res.json({ channels: metadata.channels || {} });
  }
);

/**
 * PUT /organization
 * Updates the organization's channel credential configuration.
 * Body: { sms?: { provider, credentials }, whatsapp?: { provider, credentials },
 *         email?: { provider, credentials }, push?: { provider, credentials } }
 *
 * Validation (Task 12.2):
 *  - Each provided channel must have a string `provider` and object `credentials`.
 */
router.put(
  '/organization',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body;

    // Validate each provided channel configuration
    const errors: string[] = [];
    for (const channelType of VALID_CHANNEL_TYPES) {
      const channelConfig = body[channelType];
      if (channelConfig === undefined) continue;

      if (typeof channelConfig !== 'object' || channelConfig === null || Array.isArray(channelConfig)) {
        errors.push(`${channelType} must be an object with provider and credentials`);
        continue;
      }
      if (typeof channelConfig.provider !== 'string' || channelConfig.provider.trim() === '') {
        errors.push(`${channelType}.provider must be a non-empty string`);
      }
      if (
        typeof channelConfig.credentials !== 'object' ||
        channelConfig.credentials === null ||
        Array.isArray(channelConfig.credentials)
      ) {
        errors.push(`${channelType}.credentials must be an object`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    // Fetch current metadata
    const organization = await db('organizations')
      .where({ id: req.organizationId })
      .first();

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const metadata =
      typeof organization.metadata === 'string'
        ? JSON.parse(organization.metadata)
        : organization.metadata || {};

    // Merge channel settings into metadata.channels
    const existingChannels = metadata.channels || {};
    for (const channelType of VALID_CHANNEL_TYPES) {
      if (body[channelType] !== undefined) {
        existingChannels[channelType] = {
          provider: body[channelType].provider,
          credentials: body[channelType].credentials,
        };
      }
    }
    metadata.channels = existingChannels;

    // Persist
    const [updated] = await db('organizations')
      .where({ id: req.organizationId })
      .update({
        metadata: JSON.stringify(metadata),
        updated_at: new Date(),
      })
      .returning('*');

    res.json({ channels: metadata.channels, organization_id: updated.id });
  }
);

// =============================================================================
// Stakeholder communication channel preferences (Task 12.3)
// =============================================================================

/**
 * GET /stakeholder/:id
 * Returns a stakeholder's communication channel preferences.
 */
router.get(
  '/stakeholder/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const stakeholder = await db('stakeholders')
      .where({ id, organization_id: req.organizationId })
      .first();

    if (!stakeholder) {
      res.status(404).json({ error: 'Stakeholder not found' });
      return;
    }

    const channels = Array.isArray(stakeholder.communication_channels)
      ? stakeholder.communication_channels
      : [];

    res.json({ stakeholder_id: stakeholder.id, channels });
  }
);

/**
 * PUT /stakeholder/:id
 * Updates a stakeholder's communication channel preferences.
 * Body: { channels: [{ type: string, config: object, priority: number }] }
 *
 * Validation:
 *  - channels must be an array
 *  - each entry must have a valid type, an object config, and a numeric priority
 */
router.put(
  '/stakeholder/:id',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { channels } = req.body;

    // Validate channels array
    if (!Array.isArray(channels)) {
      res.status(400).json({ error: 'channels must be an array' });
      return;
    }

    const errors: string[] = [];
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      if (!ch || typeof ch !== 'object' || Array.isArray(ch)) {
        errors.push(`channels[${i}] must be an object`);
        continue;
      }
      if (!VALID_CHANNEL_TYPES.includes(ch.type)) {
        errors.push(
          `channels[${i}].type must be one of: ${VALID_CHANNEL_TYPES.join(', ')}`
        );
      }
      if (typeof ch.config !== 'object' || ch.config === null || Array.isArray(ch.config)) {
        errors.push(`channels[${i}].config must be an object`);
      }
      if (typeof ch.priority !== 'number' || !Number.isFinite(ch.priority)) {
        errors.push(`channels[${i}].priority must be a number`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    // Ensure stakeholder exists and belongs to the organization
    const stakeholder = await db('stakeholders')
      .where({ id, organization_id: req.organizationId })
      .first();

    if (!stakeholder) {
      res.status(404).json({ error: 'Stakeholder not found' });
      return;
    }

    // Update communication_channels JSONB
    const [updated] = await db('stakeholders')
      .where({ id, organization_id: req.organizationId })
      .update({
        communication_channels: JSON.stringify(channels),
        updated_at: new Date(),
      })
      .returning('*');

    const updatedChannels = Array.isArray(updated.communication_channels)
      ? updated.communication_channels
      : JSON.parse(updated.communication_channels || '[]');

    res.json({ stakeholder_id: updated.id, channels: updatedChannels });
  }
);

export default router;
