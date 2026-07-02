import { NextResponse } from 'next/server';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import { canPartnerAccessCompany, denyPartnerWrite, isPartnerSession } from '@/lib/partner-access.util';
import { internalApiFetch } from '@/lib/internal-api.server';
import { logPartnerPortalActivity, PARTNER_PORTAL_ACTIONS } from '@/lib/partner-activity';

export async function GET(
  request: Request,
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

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit');
  const before = searchParams.get('before');
  const query = new URLSearchParams();
  if (limit) query.set('limit', limit);
  if (before) query.set('before', before);
  const queryString = query.toString();

  try {
    const response = await internalApiFetch(
      `/support-chat/${companyId}/messages${queryString ? `?${queryString}` : ''}`,
    );
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to fetch messages' },
        { status: response.status },
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logPartnerPortalActivity(auditSession, {
        action: PARTNER_PORTAL_ACTIONS.VIEW_SUPPORT_CHAT_MESSAGES,
        resourceType: 'company',
        resourceId: companyId,
        details: {
          limit: limit ? Number(limit) : undefined,
          before: before || undefined,
          messageCount: Array.isArray(payload?.data?.messages)
            ? payload.data.messages.length
            : undefined,
        },
        summary: `Partner viewed support chat messages for company ${companyId}`,
      });
    }

    return NextResponse.json(payload.data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const writeDenied = denyPartnerWrite(session);
  if (writeDenied) return writeDenied;

  const { companyId } = await params;
  const body = await request.json();
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  try {
    const response = await internalApiFetch(`/support-chat/${companyId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        adminId: session.userId,
        adminName: session.name || '',
        adminEmail: session.email || '',
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to send message' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
