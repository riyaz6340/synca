import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        organization_id: string;
        role: string;
      };
      organizationId?: string;
    }
  }
}
