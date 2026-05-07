import { NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import Template, {
  TEMPLATE_KINDS,
  TEMPLATE_SOURCE,
  TEMPLATE_STATUS,
} from '@/lib/models/Template';
import TemplateCategory, {
  TEMPLATE_CATEGORY_STATUS,
} from '@/lib/models/TemplateCategory';
import { generateTemplateThumbnailUrl } from '@/lib/template-thumbnail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required'),
  description: z.string().trim().optional().default(''),
  body: z.string().min(1, 'Template body is required'),
  jsonTemplate: z.record(z.any()).optional().default({}),
  categoryId: objectIdSchema,
});

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

    const query: Record<string, unknown> = {
      kind: TEMPLATE_KINDS.SAMPLE,
      status: TEMPLATE_STATUS.ACTIVE,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (categoryId) {
      if (!objectIdSchema.safeParse(categoryId).success) {
        return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
      }
      query.category = categoryId;
    }

    const templates = await Template.find(query)
      .populate({ path: 'category', select: 'name slug isPopular status' })
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

    const category = await TemplateCategory.findOne({
      _id: payload.categoryId,
      status: TEMPLATE_CATEGORY_STATUS.ACTIVE,
    }).lean();

    if (!category) {
      return NextResponse.json({ error: 'Template category not found' }, { status: 404 });
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

    const thumbnailURL = await generateTemplateThumbnailUrl({
      html: payload.body,
      templateName: payload.name,
    });

    const template = await Template.create({
      name: payload.name,
      description: payload.description,
      kind: TEMPLATE_KINDS.SAMPLE,
      body: payload.body,
      size: Buffer.byteLength(payload.body, 'utf-8'),
      sizeUnit: 'Bytes',
      thumbnailURL,
      category: payload.categoryId,
      jsonTemplate: payload.jsonTemplate,
      status: TEMPLATE_STATUS.ACTIVE,
      templateSource: TEMPLATE_SOURCE.SAMPLE_TEMPLATE,
      updatedBy: session.userId,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Failed to create sample template:', error);
    return NextResponse.json(
      { error: 'Failed to create sample template' },
      { status: 500 }
    );
  }
}
