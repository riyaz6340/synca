import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { tenantIsolation } from '../middleware/tenantIsolation';
import { authorize } from '../middleware/authorize';
import db from '../config/database';
import { validateBranding, BrandingInput } from '../utils/brandingValidation';

const router = Router();

// GET /name - Get organization name for the authenticated user (any role)
router.get(
  '/name',
  authenticate,
  tenantIsolation,
  async (req: Request, res: Response): Promise<void> => {
    const organization = await db('organizations')
      .select('name')
      .where({ id: req.organizationId })
      .first();

    if (!organization) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({ organization_name: organization.name });
  }
);

// Apply middleware chain: authenticate → tenantIsolation → authorize(Admin)
router.get(
  '/',
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

    res.json({ organization });
  }
);

// PUT / - Update organization settings and metadata (Admin only)
router.put(
  '/',
  authenticate,
  tenantIsolation,
  authorize('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { name, industry_module, metadata } = req.body;

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (industry_module !== undefined) updates.industry_module = industry_module;

    if (metadata !== undefined) {
      // Extract branding fields for validation
      const brandingInput: BrandingInput = {
        logo_url: metadata.logo_url,
        primary_color: metadata.primary_color,
      };

      // Only validate if branding fields are present in the request
      if (brandingInput.logo_url !== undefined || brandingInput.primary_color !== undefined) {
        const validation = validateBranding(brandingInput);
        if (!validation.valid) {
          res.status(400).json({ error: 'Validation failed', details: validation.errors });
          return;
        }
      }

      // Read existing metadata to merge (preserve unrelated keys)
      const existing = await db('organizations')
        .select('metadata')
        .where({ id: req.organizationId })
        .first();

      const existingMetadata: Record<string, unknown> =
        existing?.metadata
          ? typeof existing.metadata === 'string'
            ? JSON.parse(existing.metadata)
            : existing.metadata
          : {};

      const mergedMetadata = { ...existingMetadata };

      // Handle logo_url: null/empty clears, string sets, undefined leaves unchanged
      if (metadata.logo_url === null || metadata.logo_url === '') {
        delete mergedMetadata.logo_url;
      } else if (metadata.logo_url !== undefined) {
        mergedMetadata.logo_url = metadata.logo_url;
      }

      // Handle primary_color: null/empty clears, string sets, undefined leaves unchanged
      if (metadata.primary_color === null || metadata.primary_color === '') {
        delete mergedMetadata.primary_color;
      } else if (metadata.primary_color !== undefined) {
        mergedMetadata.primary_color = metadata.primary_color;
      }

      // Merge any other metadata keys from the request (non-branding keys)
      for (const key of Object.keys(metadata)) {
        if (key !== 'logo_url' && key !== 'primary_color') {
          if (metadata[key] === null || metadata[key] === '') {
            delete mergedMetadata[key];
          } else {
            mergedMetadata[key] = metadata[key];
          }
        }
      }

      updates.metadata = JSON.stringify(mergedMetadata);
    }

    // Always update the timestamp
    updates.updated_at = new Date();

    const [updated] = await db('organizations')
      .where({ id: req.organizationId })
      .update(updates)
      .returning('*');

    if (!updated) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json({ organization: updated });
  }
);

export default router;
