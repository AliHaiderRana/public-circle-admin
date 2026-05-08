import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dbConnect from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import EditorAsset, { EDITOR_ASSET_STATUS } from '@/lib/models/EditorAsset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  fileName: z.string().trim().min(1, 'File name is required'),
});

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bucket = (
    process.env.S3BUCKET ||
    process.env.AWS_S3_BUCKET ||
    process.env.TEMPLATE_THUMBNAILS_BUCKET
  || '').trim();
  const region = (process.env.AWS_REGION || '').trim() || 'ca-central-1';
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      { error: 'S3 is not configured. Set S3BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.' },
      { status: 500 }
    );
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

    const safeName = sanitizeFileName(parsed.data.fileName);
    const key = `assets/admin/email-assets/${Date.now()}-${safeName}`;

    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const signedUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: 600 }
    );

    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    await dbConnect();
    const asset = await EditorAsset.create({
      name: parsed.data.fileName,
      key,
      url,
      status: EDITOR_ASSET_STATUS.INACTIVE,
      createdBy: session.id || null,
    });

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

