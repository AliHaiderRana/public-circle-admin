import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import {
  SUPPORT_REQUEST_STATUS,
  SUPPORT_REQUEST_CATEGORY_LABELS,
} from '@/lib/constants';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

const SERVER_API_URL =
  process.env.SERVER_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';
const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || 'internal_admin_cron_key_2024';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, adminNotes } = body;

  if (status && !Object.values(SUPPORT_REQUEST_STATUS).includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    const response = await fetch(`${SERVER_API_URL}/internal/support-requests/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({
        ...(status ? { status } : {}),
        ...(typeof adminNotes === 'string' ? { adminNotes } : {}),
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.message || payload?.error || 'Failed to update support request' },
        { status: response.status }
      );
    }

    const supportRequest = payload?.data ?? payload;
    const previousStatus =
      typeof body.previousStatus === 'string' ? body.previousStatus : undefined;

    let companyName = '';
    const companyId = String(supportRequest?.companyId ?? '');
    if (companyId) {
      await dbConnect();
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

    return NextResponse.json(supportRequest);
  } catch (error) {
    console.error('Error updating support request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
