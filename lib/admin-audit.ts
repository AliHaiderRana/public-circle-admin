import dbConnect from '@/lib/db';
import AdminActivity from '@/lib/models/AdminActivity';
import {
  ADMIN_AUDIT_ACTION,
  type AdminAuditAction,
  type AdminAuditCategory,
  type AdminAuditSession,
} from '@/lib/admin-audit.constants';

export {
  ADMIN_AUDIT_CATEGORY,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY_LABELS,
  type AdminAuditCategory,
  type AdminAuditAction,
  type AdminAuditSession,
} from '@/lib/admin-audit.constants';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'body',
  'jsonTemplate',
]);

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key)) {
    return '[redacted]';
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return redactDetails(value as Record<string, unknown>);
  }
  return value;
}

export function redactDetails(
  details: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!details || typeof details !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    out[key] = redactValue(key, value);
  }
  return Object.keys(out).length ? out : null;
}

export function buildAuditSummary(
  action: string,
  details?: Record<string, unknown> | null
): string {
  const d = details ?? {};

  const formatCustomerRequestType = (type: unknown) => {
    if (!type) return '';
    const key = String(type);
    const labels: Record<string, string> = {
      DEDICATED_IP_ENABLED: 'Dedicated IP enable',
      DEDICATED_IP_DISABLED: 'Dedicated IP disable',
      DOWNGRADE_PLAN: 'Plan downgrade',
      EDIT_CONTACTS_PRIMARY_KEY: 'Edit contacts primary key',
      EDIT_CONTACTS_EMAIL_KEY: 'Edit contacts email key',
      EDIT_CONTACTS_FILTERS: 'Edit contact filters',
      'apple-relay-email': 'Apple relay email',
      attachment: 'Attachment',
      notification: 'Notification',
    };
    return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatStatus = (status: unknown) => {
    const s = String(status ?? 'unknown').toLowerCase();
    if (s === 'completed') return 'completed';
    if (s === 'rejected') return 'rejected';
    if (s === 'pending') return 'pending';
    return s;
  };

  switch (action) {
    case ADMIN_AUDIT_ACTION.CUSTOMER_REQUEST_STATUS: {
      const typeLabel = formatCustomerRequestType(d.type);
      const statusLabel = formatStatus(d.status);
      return typeLabel
        ? `${typeLabel} request marked as ${statusLabel}`
        : `Customer request marked as ${statusLabel}`;
    }
    case ADMIN_AUDIT_ACTION.SUPPORT_REQUEST_UPDATE: {
      const statusLabel = formatStatus(d.status);
      return `Support request marked as ${statusLabel}`;
    }
    case ADMIN_AUDIT_ACTION.COMPANY_BLOCK:
      return `Blocked company${d.companyName ? ` “${d.companyName}”` : ''}`;
    case ADMIN_AUDIT_ACTION.COMPANY_UNBLOCK:
      return `Unblocked company${d.companyName ? ` “${d.companyName}”` : ''}`;
    case ADMIN_AUDIT_ACTION.PLAN_QUOTA_UPDATE:
      return `Updated plan quota${d.planName ? ` for “${d.planName}”` : ''}`;
    case ADMIN_AUDIT_ACTION.CRON_TRIGGER:
      return `Triggered cron job “${d.cronName ?? 'unknown'}”`;
    case ADMIN_AUDIT_ACTION.CRON_SEED:
      return 'Seeded cron job definitions';
    case ADMIN_AUDIT_ACTION.TRANSLATION_CREATE:
      return `Added translation${d.key ? ` “${d.key}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TRANSLATION_UPDATE:
      return `Updated translation${d.key ? ` “${d.key}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TRANSLATION_DELETE:
      return `Deleted translation${d.key ? ` “${d.key}”` : ''}`;
    case ADMIN_AUDIT_ACTION.LOCALE_CREATE:
      return `Added language${d.code ? ` “${d.code}”` : ''}`;
    case ADMIN_AUDIT_ACTION.LOCALE_UPDATE:
      return `Updated language${d.code ? ` “${d.code}”` : ''}${
        d.enabled !== undefined ? ` (${d.enabled ? 'enabled' : 'disabled'})` : ''
      }`;
    case ADMIN_AUDIT_ACTION.LOCALE_DELETE:
      return `Removed language${d.code ? ` “${d.code}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TRANSLATION_CONFIG_UPDATE:
      return 'Updated translation admin settings';
    case ADMIN_AUDIT_ACTION.UI_TERM_UPSERT:
      return `Saved context help${d.key ? ` “${d.key}”` : ''}`;
    case ADMIN_AUDIT_ACTION.UI_TERM_DELETE:
      return `Deleted context help${d.key ? ` “${d.key}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_CREATE:
      return `Created sample template${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_UPDATE:
      return `Updated sample template${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_DELETE:
      return `Deleted sample template${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_ARCHIVE:
      return `Archived sample template${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_UNARCHIVE:
      return `Restored sample template${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TEMPLATE_CATEGORY_CREATE:
      return `Created template category${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TEMPLATE_CATEGORY_UPDATE:
      return `Updated template category${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TEMPLATE_CATEGORY_DELETE:
      return `Deleted template category${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.ADMIN_USER_CREATE:
      return `Created admin user “${d.email ?? 'unknown'}”${
        d.isSuperAdmin ? ' (super admin)' : ''
      }`;
    case ADMIN_AUDIT_ACTION.ADMIN_USER_DELETE:
      return `Deleted admin user${d.email ? ` “${d.email}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SYSTEM_CONFIG_UPDATE:
      return 'Updated system configuration';
    case ADMIN_AUDIT_ACTION.IMPERSONATE_START:
      return `Started “Login as user” for ${d.impersonatedUserEmail ?? d.userId ?? 'user'}`;
    default:
      return action.replace(/\./g, ' ').replace(/_/g, ' ');
  }
}

export async function logAdminActivity(
  session: AdminAuditSession,
  entry: {
    action: AdminAuditAction | string;
    category: AdminAuditCategory;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown> | null;
    summary?: string;
  }
): Promise<void> {
  if (!session?.userId || !session?.email) return;

  const details = redactDetails(entry.details ?? null);
  const summary = entry.summary ?? buildAuditSummary(entry.action, details);

  try {
    await dbConnect();
    await AdminActivity.create({
      adminId: session.userId,
      adminEmail: session.email,
      adminName: session.name ?? '',
      actorWasSuperAdmin: Boolean(session.isSuperAdmin),
      action: entry.action,
      category: entry.category,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ? String(entry.resourceId) : null,
      summary,
      details,
    });
  } catch (err) {
    console.error('[admin-audit]', err);
  }
}
