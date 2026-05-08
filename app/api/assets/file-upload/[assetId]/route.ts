import { NextResponse } from 'next/server';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import dbConnect from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import EditorAsset, { EDITOR_ASSET_STATUS } from '@/lib/models/EditorAsset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { assetId } = await params;
    await dbConnect();
    const asset = await EditorAsset.findByIdAndUpdate(
      assetId,
      { status: EDITOR_ASSET_STATUS.ACTIVE },
      { new: true }
    ).lean();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        _id: String(asset._id),
        name: asset.name || '',
        url: asset.url || '',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to activate asset' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
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

  try {
    const { assetId } = await params;
    await dbConnect();
    const asset = await EditorAsset.findById(assetId).lean();
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (bucket && accessKeyId && secretAccessKey && asset.key) {
      const s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: asset.key,
        })
      );
    }

    await EditorAsset.findByIdAndDelete(assetId);
    return NextResponse.json({ data: {} });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to delete asset' },
      { status: 500 }
    );
  }
}

