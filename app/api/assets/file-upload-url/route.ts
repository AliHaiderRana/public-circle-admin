import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  buildSampleTemplateImageKey,
  resolveTemplateStorage,
  templateFileUrl,
} from '@/lib/template-storage';
import dbConnect from '@/lib/db';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import EditorAsset, { EDITOR_ASSET_STATUS } from '@/lib/models/EditorAsset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  fileName: z.string().trim().min(1, 'File name is required'),
  templateId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid template id'),
});

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const { bucket, region, s3Client } = resolveTemplateStorage();
    const key = await buildSampleTemplateImageKey({
      s3Client,
      bucket,
      templateId: parsed.data.templateId,
      fileName: parsed.data.fileName,
    });

    const signedUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: 600 }
    );

    const url = templateFileUrl({ bucket, region, key });

    await dbConnect();
    const asset = await EditorAsset.create({
      name: parsed.data.fileName,
      key,
      url,
      status: EDITOR_ASSET_STATUS.INACTIVE,
      createdBy: session.id || null,
    });

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.EDITOR_ASSET_UPLOAD,
        category: ADMIN_AUDIT_CATEGORY.TEMPLATE,
        resourceType: 'editor_asset',
        resourceId: String(asset._id),
        details: { name: parsed.data.fileName },
      });
    }

    return NextResponse.json({
      data: {
        signedUrl,
        assetId: asset._id,
        url,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

