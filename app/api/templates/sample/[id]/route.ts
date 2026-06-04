import { NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import Template, {
  TEMPLATE_KINDS,
  TEMPLATE_STATUS,
} from '@/lib/models/Template';
import TemplateCategory, {
  TEMPLATE_CATEGORY_STATUS,
} from '@/lib/models/TemplateCategory';
import { generateTemplateThumbnailUrl } from '@/lib/template-thumbnail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    body: z.string().min(1).optional(),
    jsonTemplate: z.record(z.any()).optional(),
    categoryId: objectIdSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required for update',
  });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    if (!objectIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const query: Record<string, unknown> = {
      _id: id,
      kind: TEMPLATE_KINDS.SAMPLE,
    };

    if (!includeArchived) {
      query.status = TEMPLATE_STATUS.ACTIVE;
    }

    const template = await Template.findOne(query)
      .populate({ path: 'category', select: 'name slug isPopular status' })
      .lean();

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Failed to fetch template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
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

    const body = await request.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    const currentTemplate = await Template.findOne({
      _id: id,
      kind: TEMPLATE_KINDS.SAMPLE,
      status: TEMPLATE_STATUS.ACTIVE,
    }).lean();

    if (!currentTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (payload.name) {
      const duplicate = await Template.findOne({
        _id: { $ne: id },
        kind: TEMPLATE_KINDS.SAMPLE,
        status: TEMPLATE_STATUS.ACTIVE,
        name: payload.name,
      }).lean();

      if (duplicate) {
        return NextResponse.json(
          { error: 'A sample template with this name already exists' },
          { status: 409 }
        );
      }
    }

    if (payload.categoryId) {
      const category = await TemplateCategory.findOne({
        _id: payload.categoryId,
        status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
      }).lean();

      if (!category) {
        return NextResponse.json({ error: 'Template category not found' }, { status: 404 });
      }
    }

    const updateDoc: Record<string, unknown> = {
      ...payload,
      updatedBy: session.userId,
      updatedAt: new Date(),
    };

    if (payload.categoryId) {
      updateDoc.category = payload.categoryId;
      delete updateDoc.categoryId;
    }

    if (payload.body) {
      updateDoc.size = Buffer.byteLength(payload.body, 'utf-8');
      updateDoc.thumbnailURL = await generateTemplateThumbnailUrl({
        html: payload.body,
        templateName: payload.name || currentTemplate.name,
      });
    }

    const template = await Template.findByIdAndUpdate(id, updateDoc, {
      new: true,
    })
      .populate({ path: 'category', select: 'name slug isPopular status' })
      .lean();

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.TEMPLATE,
        resourceType: 'sample_template',
        resourceId: id,
        details: {
          name: template?.name ?? payload.name,
          fieldsChanged: Object.keys(payload),
        },
      });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(
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

    const template = await Template.findOneAndDelete(
      {
        _id: id,
        kind: TEMPLATE_KINDS.SAMPLE,
      },
    ).lean();

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_DELETE,
        category: ADMIN_AUDIT_CATEGORY.TEMPLATE,
        resourceType: 'sample_template',
        resourceId: id,
        details: { name: template.name },
      });
    }

    return NextResponse.json({ success: true, message: 'Template deleted permanently' });
  } catch (error) {
    console.error('Failed to delete template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
