import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import Company from '@/lib/models/Company';
import { requireSuperAdminSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { canAdminAccessTicket } from '@/lib/support-access.util';
import { formatSupportReferenceId } from '@/lib/support-admin.util';
import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import { getBackendApiUrl, getBackendInternalApiKey } from '@/lib/backend-api.server';

const CHAT_DELETABLE_STATUSES = new Set<string>([
  SUPPORT_REQUEST_STATUS.RESOLVED,
  SUPPORT_REQUEST_STATUS.CLOSED,
]);

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  const { id } = await params;

  try {
    await dbConnect();
    const ticket = await SupportRequest.findById(id)
      .select('assignedAdminId companyId subject status')
      .lean();

    if (!ticket) {
      return NextResponse.json({ error: 'Support request not found' }, { status: 404 });
    }

    if (!canAdminAccessTicket(session, ticket)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!ticket.status || !CHAT_DELETABLE_STATUSES.has(ticket.status)) {
      return NextResponse.json(
        { error: 'Only resolved tickets can be deleted. Resolve the ticket first.' },
        { status: 400 },
      );
    }

    const response = await fetch(`${await getBackendApiUrl()}/internal/support-requests/${id}/chat`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': await getBackendInternalApiKey(),
      },
      body: JSON.stringify({ adminId: session.userId }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.errorMessage ||
            payload?.error ||
            payload?.message ||
            'Failed to delete support ticket',
        },
        { status: response.status },
      );
    }

    const data = payload.data ?? payload;

    await SupportRequest.findByIdAndDelete(id);

    let companyName = '';
    if (ticket.companyId) {
      const company = await Company.findById(ticket.companyId).select('name').lean();
      companyName = company?.name ?? '';
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SUPPORT_CHAT_DELETE,
        category: ADMIN_AUDIT_CATEGORY.SUPPORT_REQUEST,
        resourceType: 'support_request',
        resourceId: id,
        details: {
          referenceId: formatSupportReferenceId(id),
          subject: ticket.subject,
          companyId: String(ticket.companyId ?? ''),
          companyName,
          messagesDeleted: data.messagesDeleted ?? 0,
          attachmentsDeleted: data.attachmentsDeleted ?? 0,
          ticketDeleted: true,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[support-ticket-delete] failed:', err);
    return NextResponse.json({ error: 'Failed to delete support ticket' }, { status: 500 });
  }
}
