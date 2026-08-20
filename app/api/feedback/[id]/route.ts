import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import { FEEDBACK_STATUS } from '@/lib/constants';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import { isPartnerSession } from '@/lib/partner-access.util';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (isPartnerSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const status = typeof body?.status === 'string' ? body.status : '';
  const adminNotes =
    typeof body?.adminNotes === 'string' ? body.adminNotes.trim() : undefined;

  if (status && !Object.values(FEEDBACK_STATUS).includes(status as typeof FEEDBACK_STATUS[keyof typeof FEEDBACK_STATUS])) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  if (!status && adminNotes === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await dbConnect();

  try {
    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    const previousStatus = feedback.status;
    if (status) {
      feedback.status = status;
    }
    if (adminNotes !== undefined) {
      feedback.adminNotes = adminNotes;
    }
    await feedback.save();

    const populated = await Feedback.findById(feedback._id)
      .populate({ path: 'companyId', model: Company, select: 'name' })
      .populate({
        path: 'userId',
        model: User,
        select: 'firstName lastName emailAddress',
      })
      .lean();

    const companyForAudit = populated?.companyId as { name?: string } | null | undefined;

    const auditSession = toAdminAuditSession(session);
    if (auditSession && status && previousStatus !== status) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.FEEDBACK_STATUS,
        category: ADMIN_AUDIT_CATEGORY.FEEDBACK,
        resourceType: 'product_feedback',
        resourceId: id,
        details: {
          previousStatus,
          status,
          type: feedback.type,
          companyId: String(feedback.companyId ?? ''),
          companyName: companyForAudit?.name ?? '',
        },
      });
    }

    return NextResponse.json(populated);
  } catch (error) {
    console.error('Error updating product feedback:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
