import db from '../config/database';

interface AuditEntry {
  organization_id?: string;
  user_id?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'PASSWORD_CHANGE';
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db('audit_logs').insert({
      organization_id: entry.organization_id || null,
      user_id: entry.user_id || null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      details: JSON.stringify(entry.details || {}),
      ip_address: entry.ip_address || null,
    });
  } catch (error) {
    // Don't let audit logging failures break the main flow
    console.error('[AUDIT] Failed to log:', error);
  }
}
