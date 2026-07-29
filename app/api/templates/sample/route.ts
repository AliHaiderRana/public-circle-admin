import { NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import Template, {
  TEMPLATE_KINDS,
  TEMPLATE_SOURCE,
  TEMPLATE_STATUS,
} from '@/lib/models/Template';
import TemplateCategory, {
  TEMPLATE_CATEGORY_STATUS,
} from '@/lib/models/TemplateCategory';
import { generateTemplateThumbnailUrl } from '@/lib/template-thumbnail';
import { resolveCategoryIds } from '@/lib/template-categories.util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

const categoryIdsSchema = z
  .array(objectIdSchema)
  .min(1, 'At least one template category is required');

const createTemplateSchema = z
  .object({
    name: z.string().trim().min(1, 'Template name is required'),
    description: z.string().trim().optional().default(''),
    body: z.string().min(1, 'Template body is required'),
    jsonTemplate: z.record(z.any()).optional().default({}),
    categoryIds: categoryIdsSchema.optional(),
    categoryId: objectIdSchema.optional(),
  })
  .refine((value) => resolveCategoryIds(value).length > 0, {
    message: 'At least one template category is required',
  });

const categoryPopulate = [
  { path: 'category', select: 'name slug isPopular status' },
  { path: 'categories', select: 'name slug isPopular status' },
] as const;

async function validateCategoryIds(categoryIds: string[]) {
  const categories = await TemplateCategory.find({
    _id: { $in: categoryIds },
    status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
  }).lean();

  if (categories.length !== categoryIds.length) {
    return null;
  }

  return categories;
}

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const categoryId = searchParams.get('categoryId')?.trim() || '';
    const statusParam = searchParams.get('status')?.trim().toUpperCase() || 'ACTIVE';

    const query: Record<string, unknown> = {
      kind: TEMPLATE_KINDS.SAMPLE,
    };

    if (statusParam === 'ACTIVE') {
      query.status = TEMPLATE_STATUS.ACTIVE;
    } else if (statusParam === 'ARCHIVED') {
      query.status = TEMPLATE_STATUS.ARCHIVED;
    } else if (statusParam !== 'ALL') {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      andConditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (categoryId) {
      if (!objectIdSchema.safeParse(categoryId).success) {
        return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
      }
      andConditions.push({
        $or: [
          { categories: categoryId },
          { category: categoryId },
        ],
      });
    }

    if (andConditions.length === 1) {
      Object.assign(query, andConditions[0]);
    } else if (andConditions.length > 1) {
      query.$and = andConditions;
    }

    const templates = await Template.find(query)
      .populate(categoryPopulate)
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Failed to fetch sample templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sample templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const categoryIds = resolveCategoryIds(payload);

    const categories = await validateCategoryIds(categoryIds);
    if (!categories) {
      return NextResponse.json({ error: 'One or more template categories were not found' }, { status: 404 });
    }

    const duplicate = await Template.findOne({
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

    const templateId = new mongoose.Types.ObjectId();

    const thumbnailURL = await generateTemplateThumbnailUrl({
      html: payload.body,
      templateId: String(templateId),
    });

    const template = await Template.create({
      _id: templateId,
      name: payload.name,
      description: payload.description,
      kind: TEMPLATE_KINDS.SAMPLE,
      body: payload.body,
      size: Buffer.byteLength(payload.body, 'utf-8'),
      sizeUnit: 'Bytes',
      thumbnailURL,
      category: categoryIds[0],
      categories: categoryIds,
      jsonTemplate: payload.jsonTemplate,
      status: TEMPLATE_STATUS.ACTIVE,
      templateSource: TEMPLATE_SOURCE.SAMPLE_TEMPLATE,
      updatedBy: session.userId,
    });

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_CREATE,
        category: ADMIN_AUDIT_CATEGORY.TEMPLATE,
        resourceType: 'sample_template',
        resourceId: String(template._id),
        details: { name: template.name },
      });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Failed to create sample template:', error);
    return NextResponse.json(
      { error: 'Failed to create sample template' },
      { status: 500 }
    );
  }
}
