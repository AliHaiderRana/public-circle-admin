import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import EditorAsset, { EDITOR_ASSET_STATUS } from '@/lib/models/EditorAsset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const assets = await EditorAsset.find({ status: EDITOR_ASSET_STATUS.ACTIVE })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      data: assets.map((asset: any) => ({
        _id: String(asset._id),
        name: asset.name || '',
        url: asset.url || '',
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

