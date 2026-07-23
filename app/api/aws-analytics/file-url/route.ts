import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/auth';
import { getPresignedFileUrl } from '@/lib/aws-analytics.server';

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const bucket = (searchParams.get('bucket') || '').trim();
    const key = (searchParams.get('key') || '').trim();
    const download = searchParams.get('download') === '1';
    if (!bucket || !key) {
      return NextResponse.json(
        { error: 'bucket and key query params are required' },
        { status: 400 }
      );
    }

    const url = await getPresignedFileUrl(bucket, key, download);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[aws-analytics/file-url]', err);
    return NextResponse.json({ error: 'Failed to generate file link' }, { status: 500 });
  }
}
