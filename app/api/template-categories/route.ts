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

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required'),
  description: z.string().trim().optional().default(''),
  isPopular: z.boolean().optional().default(false),
});

function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function uniqueSlug(baseSlug: string) {
  let slug = baseSlug;
  let index = 1;

  while (
    await TemplateCategory.exists({
      slug,
      status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
    })
  ) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }

  return slug;
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const categories = await TemplateCategory.aggregate([
      {
        $match: {
          status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
        },
      },
      {
        $lookup: {
          from: 'templates',
          let: { categoryId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$category', '$$categoryId'] },
                    { $eq: ['$kind', TEMPLATE_KINDS.SAMPLE] },
                    { $eq: ['$status', TEMPLATE_STATUS.ACTIVE] },
                  ],
                },
              },
            },
            {
              $count: 'count',
            },
          ],
          as: 'templatesMeta',
        },
      },
      {
        $addFields: {
          templateCount: {
            $ifNull: [{ $arrayElemAt: ['$templatesMeta.count', 0] }, 0],
          },
        },
      },
      {
        $project: {
          templatesMeta: 0,
        },
      },
      {
        $sort: {
          name: 1,
        },
      },
    ]);

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Failed to fetch template categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template categories' },
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
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    const existing = await TemplateCategory.findOne({
      name: payload.name,
      status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
    }).lean();

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    const slug = await uniqueSlug(toSlug(payload.name));

    const category = await TemplateCategory.create({
      name: payload.name,
      description: payload.description,
      isPopular: payload.isPopular,
      slug,
      status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
    });

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.TEMPLATE_CATEGORY_CREATE,
        category: ADMIN_AUDIT_CATEGORY.TEMPLATE_CATEGORY,
        resourceType: 'template_category',
        resourceId: String(category._id),
        details: { name: category.name },
      });
    }

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Failed to create template category:', error);
    return NextResponse.json(
      { error: 'Failed to create template category' },
      { status: 500 }
    );
  }
}
