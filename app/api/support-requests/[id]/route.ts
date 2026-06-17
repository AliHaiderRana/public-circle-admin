import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import SupportRequest from '@/lib/models/SupportRequest';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  SUPPORT_REQUEST_STATUS,
  SUPPORT_REQUEST_CATEGORY_LABELS,
} from '@/lib/constants';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { formatSupportReferenceId } from '@/lib/support-admin.util';
import { buildStatusTimelineForAdmin } from '@/lib/support-status-timeline.util';
import { formatAssignmentHistoryForAdmin } from '@/lib/support-assignment.util';
import { canAdminAccessTicket } from '@/lib/support-access.util';

const SERVER_API_URL =
  process.env.SERVER_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';
const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || 'internal_admin_cron_key_2024';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await dbConnect();
    const request = await SupportRequest.findById(id)
      .populate({ path: 'companyId', model: Company, select: '_id name' })
      .populate({
        path: 'userId',
        model: User,
        select: 'firstName lastName emailAddress',
      })
      .lean();

    if (!request) {
      return NextResponse.json({ error: 'Support request not found' }, { status: 404 });
    }

    if (!canAdminAccessTicket(session, request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      ...request,
      referenceId: formatSupportReferenceId(String(request._id)),
      statusTimeline: buildStatusTimelineForAdmin({
        statusHistory: request.statusHistory as Parameters<typeof buildStatusTimelineForAdmin>[0]['statusHistory'],
        createdAt: request.createdAt,
      }),
      assignmentHistory: formatAssignmentHistoryForAdmin(
        request.assignmentHistory as Parameters<typeof formatAssignmentHistoryForAdmin>[0],
      ),
    });
  } catch (error) {
    console.error('Error fetching support request:', error);
    return NextResponse.json({ error: 'Failed to fetch support request' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    status,
    adminNotes,
    assignedAdminId,
    assignedAdminName,
    anchorMessageId,
    forceResolve,
  } = body;

  if (status && !Object.values(SUPPORT_REQUEST_STATUS).includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  if (assignedAdminId !== undefined && !session.isSuperAdmin) {
    const selfAssign =
      assignedAdminId && String(assignedAdminId) === String(session.userId);

    if (!selfAssign) {
      return NextResponse.json(
        { error: 'Only super admins can change ticket assignment' },
        { status: 403 },
      );
    }

    await dbConnect();
    const existing = await SupportRequest.findById(id).select('assignedAdminId').lean();
    if (
      existing?.assignedAdminId &&
      String(existing.assignedAdminId) !== String(session.userId)
    ) {
      return NextResponse.json(
        { error: 'This ticket is already assigned to another admin' },
        { status: 403 },
      );
    }
  }

  if (typeof adminNotes === 'string' && !session.isSuperAdmin) {
    return NextResponse.json(
      { error: 'Only super admins can update private team notes' },
      { status: 403 },
    );
  }

  if (forceResolve && !session.isSuperAdmin) {
    return NextResponse.json(
      { error: 'Only super admins can resolve tickets without customer confirmation' },
      { status: 403 },
    );
  }

  try {
    await dbConnect();
    const existingTicket = await SupportRequest.findById(id)
      .select('assignedAdminId')
      .lean();

    if (!existingTicket) {
      return NextResponse.json({ error: 'Support request not found' }, { status: 404 });
    }

    if (!canAdminAccessTicket(session, existingTicket)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const response = await fetch(`${SERVER_API_URL}/internal/support-requests/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({
        ...(status ? { status } : {}),
        ...(typeof adminNotes === 'string' ? { adminNotes } : {}),
        ...(assignedAdminId !== undefined
          ? {
              assignedAdminId: assignedAdminId || null,
              assignedAdminName: assignedAdminName || '',
              assignedByAdminId: session.userId,
              assignedByName: session.name || session.email || '',
              anchorMessageId: anchorMessageId || null,
            }
          : {}),
        ...(status
          ? {
              actingAdminId: session.userId,
              actingAdminName: session.name || session.email || '',
            }
          : {}),
        ...(forceResolve ? { forceResolve: true } : {}),
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.message || payload?.error || 'Failed to update support request' },
        { status: response.status },
      );
    }

    const supportRequest = payload?.data ?? payload;
    const previousStatus =
      typeof body.previousStatus === 'string' ? body.previousStatus : undefined;

    await dbConnect();
    const localUpdate: Record<string, unknown> = {};
    if (typeof adminNotes === 'string') localUpdate.adminNotes = adminNotes;
    if (supportRequest?.status) localUpdate.status = supportRequest.status;
    if (assignedAdminId !== undefined) {
      localUpdate.assignedAdminId = assignedAdminId || null;
      localUpdate.assignedAdminName = assignedAdminName || '';
    }
    if (supportRequest?.pendingResolutionAt !== undefined) {
      localUpdate.pendingResolutionAt = supportRequest.pendingResolutionAt;
    }
    if (supportRequest?.autoResolveAt !== undefined) {
      localUpdate.autoResolveAt = supportRequest.autoResolveAt;
    }

    if (Object.keys(localUpdate).length > 0) {
      await SupportRequest.findByIdAndUpdate(id, localUpdate);
    }

    let companyName = '';
    const companyId = String(supportRequest?.companyId ?? '');
    if (companyId) {
      const company = await Company.findById(companyId).select('name').lean();
      companyName = company?.name ?? '';
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SUPPORT_REQUEST_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.SUPPORT_REQUEST,
        resourceType: 'support_request',
        resourceId: id,
        details: {
          previousStatus: previousStatus ?? null,
          status: supportRequest?.status ?? status ?? null,
          companyId,
          companyName,
          category: supportRequest?.category,
          categoryLabel:
            SUPPORT_REQUEST_CATEGORY_LABELS[supportRequest?.category] ||
            supportRequest?.category,
          subject: supportRequest?.subject,
          adminNotesUpdated: typeof adminNotes === 'string',
        },
      });
    }

    const refreshed = await SupportRequest.findById(id)
      .populate({ path: 'companyId', model: Company, select: '_id name' })
      .populate({
        path: 'userId',
        model: User,
        select: 'firstName lastName emailAddress',
      })
      .lean();

    return NextResponse.json({
      ...(refreshed ?? supportRequest),
      referenceId: formatSupportReferenceId(id),
    });
  } catch (error) {
    console.error('Error updating support request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
