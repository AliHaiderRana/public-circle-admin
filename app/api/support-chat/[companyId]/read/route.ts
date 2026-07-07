import { NextResponse } from 'next/server';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import { canPartnerAccessCompany, isPartnerSession } from '@/lib/partner-access.util';
import { internalApiFetch } from '@/lib/internal-api.server';
import { logPartnerPortalActivity, PARTNER_PORTAL_ACTIONS } from '@/lib/partner-activity';
import { schedulePartnerRealtimeStatsForCompany } from '@/lib/partner-realtime-push.server';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await params;

  if (isPartnerSession(session)) {
    const allowed = await canPartnerAccessCompany(session, companyId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const response = await internalApiFetch(`/support-chat/${companyId}/read`, {
      method: 'PATCH',
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to mark thread as read' },
        { status: response.status },
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logPartnerPortalActivity(auditSession, {
        action: PARTNER_PORTAL_ACTIONS.MARK_SUPPORT_CHAT_READ,
        resourceType: 'company',
        resourceId: companyId,
        details: { companyId },
        summary: 'Partner marked support chat thread as read',
      });
    }

    void schedulePartnerRealtimeStatsForCompany(companyId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to mark thread as read' }, { status: 500 });
  }
}
