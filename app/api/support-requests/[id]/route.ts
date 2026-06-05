import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

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

  await dbConnect();

  try {
    const supportRequest = await SupportRequest.findById(id);
    if (!supportRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const previousStatus = supportRequest.status;

    if (status) {
      supportRequest.status = status;
    }
    if (typeof adminNotes === 'string') {
      supportRequest.adminNotes = adminNotes;
    }

    await supportRequest.save();

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SUPPORT_REQUEST_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.SUPPORT_REQUEST,
        resourceType: 'support_request',
        resourceId: id,
        details: {
          previousStatus,
          status: supportRequest.status,
          companyId: String(supportRequest.companyId ?? ''),
          category: supportRequest.category,
        },
      });
    }

    return NextResponse.json(supportRequest);
  } catch (error) {
    console.error('Error updating support request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
