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
import TemplateCategory, {
  TEMPLATE_CATEGORY_STATUS,
} from '@/lib/models/TemplateCategory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    isPopular: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required for update',
  });

function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function uniqueSlug(baseSlug: string, excludeId?: string) {
  let slug = baseSlug;
  let index = 1;

  while (
    await TemplateCategory.exists({
      _id: excludeId ? { $ne: excludeId } : { $exists: true },
      slug,
      status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
    })
  ) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }

  return slug;
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
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    if (payload.name) {
      const duplicate = await TemplateCategory.findOne({
        _id: { $ne: id },
        name: payload.name,
        status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
      }).lean();

      if (duplicate) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        );
      }
    }

    const updateDoc: Record<string, unknown> = {
      ...payload,
      updatedAt: new Date(),
    };

    if (payload.name) {
      updateDoc.slug = await uniqueSlug(toSlug(payload.name), id);
    }

    const category = await TemplateCategory.findOneAndUpdate(
      { _id: id, status: TEMPLATE_CATEGORY_STATUS.ACTIVE },
      updateDoc,
      { new: true }
    ).lean();

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.TEMPLATE_CATEGORY_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.TEMPLATE_CATEGORY,
        resourceType: 'template_category',
        resourceId: id,
        details: { name: category.name, fieldsChanged: Object.keys(payload) },
      });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Failed to update category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
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
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    const activeTemplateCount = await Template.countDocuments({
      category: id,
      kind: TEMPLATE_KINDS.SAMPLE,
      status: TEMPLATE_STATUS.ACTIVE,
    });

    if (activeTemplateCount > 0) {
      return NextResponse.json(
        {
          error:
            'This category contains templates and cannot be deleted. Move or delete templates first.',
        },
        { status: 409 }
      );
    }

    const category = await TemplateCategory.findOneAndUpdate(
      {
        _id: id,
        status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
      },
      {
        status: TEMPLATE_CATEGORY_STATUS.ARCHIVED,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true }
    ).lean();

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.TEMPLATE_CATEGORY_DELETE,
        category: ADMIN_AUDIT_CATEGORY.TEMPLATE_CATEGORY,
        resourceType: 'template_category',
        resourceId: id,
        details: { name: category.name },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
