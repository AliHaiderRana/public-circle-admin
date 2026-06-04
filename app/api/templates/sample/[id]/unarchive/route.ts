import { NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import Template, { TEMPLATE_KINDS, TEMPLATE_STATUS } from '@/lib/models/Template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const { id } = await params;
    if (!objectIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const template = await Template.findOneAndUpdate(
      {
        _id: id,
        kind: TEMPLATE_KINDS.SAMPLE,
        status: TEMPLATE_STATUS.ARCHIVED,
      },
      {
        status: TEMPLATE_STATUS.ACTIVE,
        deletedAt: null,
        updatedAt: new Date(),
        updatedBy: session.userId,
      },
      { new: true }
    ).lean();

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_UNARCHIVE,
        category: ADMIN_AUDIT_CATEGORY.TEMPLATE,
        resourceType: 'sample_template',
        resourceId: id,
        details: { name: template.name },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to unarchive template:', error);
    return NextResponse.json({ error: 'Failed to unarchive template' }, { status: 500 });
  }
}
