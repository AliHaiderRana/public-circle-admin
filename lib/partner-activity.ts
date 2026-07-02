import { logAdminActivity } from '@/lib/admin-audit';
import {
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
  type AdminAuditSession,
} from '@/lib/admin-audit.constants';

export async function logPartnerPortalActivity(
  session: AdminAuditSession,
  entry: {
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown> | null;
    summary?: string;
  },
): Promise<void> {
  if (!session.isPartner) return;

  await logAdminActivity(session, {
    action: entry.action,
    category: ADMIN_AUDIT_CATEGORY.PARTNER_PORTAL,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    details: {
      referralRole: session.referralRole,
      ...entry.details,
    },
    summary: entry.summary,
  });
}

export const PARTNER_PORTAL_ACTIONS = {
  LOGIN: ADMIN_AUDIT_ACTION.PARTNER_PORTAL_LOGIN,
  VIEW_COMPANY: ADMIN_AUDIT_ACTION.PARTNER_PORTAL_VIEW_COMPANY,
  IMPERSONATE_START: ADMIN_AUDIT_ACTION.IMPERSONATE_START,
  VIEW_SUPPORT_REQUESTS: 'partner_portal.view_support_requests',
  VIEW_SUPPORT_REQUEST: 'partner_portal.view_support_request',
  VIEW_SUPPORT_MESSAGES: 'partner_portal.view_support_messages',
  VIEW_SUPPORT_CHAT_THREADS: 'partner_portal.view_support_chat_threads',
  VIEW_SUPPORT_CHAT_MESSAGES: 'partner_portal.view_support_chat_messages',
  MARK_SUPPORT_CHAT_READ: 'partner_portal.mark_support_chat_read',
  VIEW_CAMPAIGN: 'partner_portal.view_campaign',
  VIEW_CAMPAIGN_RUNS: 'partner_portal.view_campaign_runs',
  VIEW_CAMPAIGN_RUN: 'partner_portal.view_campaign_run',
  VIEW_CAMPAIGN_RUN_WAREHOUSE: 'partner_portal.view_campaign_run_warehouse',
} as const;
