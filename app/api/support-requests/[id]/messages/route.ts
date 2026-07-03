import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import Company from '@/lib/models/Company';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';
import { formatAdminDisplayName } from '@/lib/support-admin.util';
import {
  canSessionAccessTicket,
  denyPartnerSupportMessageWrite,
} from '@/lib/partner-access.util';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { SUPPORT_REQUEST_CATEGORY_LABELS } from '@/lib/constants';
import { logPartnerPortalActivity, PARTNER_PORTAL_ACTIONS } from '@/lib/partner-activity';
import { enrichSupportChatMessagesWithSenderRoles } from '@/lib/support-message-sender.util';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit');
  const before = searchParams.get('before');
  const query = new URLSearchParams();
  if (limit) query.set('limit', limit);
  if (before) query.set('before', before);
  const queryString = query.toString();

  try {
    await dbConnect();
    const ticket = await SupportRequest.findById(id).select('assignedAdminId companyId').lean();
    if (!ticket) {
      return NextResponse.json({ error: 'Support request not found' }, { status: 404 });
    }
    if (!(await canSessionAccessTicket(session, ticket))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const response = await internalApiFetch(
      `/support-requests/${id}/messages${queryString ? `?${queryString}` : ''}`,
      { timeoutMs: 15000 },
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || payload?.error || 'Failed to fetch messages' },
        { status: response.status },
      );
    }

    const data = payload.data ?? payload;

    if (Array.isArray(data?.messages)) {
      data.messages = await enrichSupportChatMessagesWithSenderRoles(data.messages);
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logPartnerPortalActivity(auditSession, {
        action: PARTNER_PORTAL_ACTIONS.VIEW_SUPPORT_MESSAGES,
        resourceType: 'support_request',
        resourceId: id,
        details: {
          limit: limit ? Number(limit) : undefined,
          before: before || undefined,
          messageCount: Array.isArray(data?.messages) ? data.messages.length : undefined,
        },
        summary: `Partner viewed support request messages for ticket ${id}`,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[support-messages] fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const internal = Boolean(body.internal);

  const writeDenied = denyPartnerSupportMessageWrite(session, { internal });
  if (writeDenied) return writeDenied;
  const attachment = body.attachment;

  if (!message && !attachment) {
    return NextResponse.json({ error: 'Message or image is required' }, { status: 400 });
  }

  try {
    await dbConnect();
    const ticket = await SupportRequest.findById(id).select('assignedAdminId companyId').lean();
    if (!ticket) {
      return NextResponse.json({ error: 'Support request not found' }, { status: 404 });
    }
    if (!(await canSessionAccessTicket(session, ticket))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminDisplayName = formatAdminDisplayName(session.name, session.email);
    const response = await internalApiFetch(`/support-requests/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        internal,
        attachment,
        adminId: session.userId,
        adminName: adminDisplayName,
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

    const message = payload.data ?? payload;
    const [enrichedMessage] = await enrichSupportChatMessagesWithSenderRoles(
      message && typeof message === 'object' ? [message] : [],
    );

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      const ticketDoc = await SupportRequest.findById(id)
        .select('subject category companyId')
        .lean();
      let companyName = '';
      if (ticketDoc?.companyId) {
        const company = await Company.findById(ticketDoc.companyId).select('name').lean();
        companyName = company?.name ?? '';
      }
      const category = ticketDoc?.category;
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SUPPORT_MESSAGE_REPLY,
        category: ADMIN_AUDIT_CATEGORY.SUPPORT_REQUEST,
        resourceType: 'support_request',
        resourceId: id,
        details: {
          internal,
          hasAttachment: Boolean(attachment),
          messagePreview: message.slice(0, 200),
          subject: ticketDoc?.subject,
          category,
          categoryLabel:
            (category && SUPPORT_REQUEST_CATEGORY_LABELS[category]) || category,
          companyName,
          actorName: adminDisplayName,
          actorIsPartner: Boolean(session.isPartner),
          referralRole: session.referralRole ?? null,
        },
      });
    }

    return NextResponse.json(enrichedMessage ?? message, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
