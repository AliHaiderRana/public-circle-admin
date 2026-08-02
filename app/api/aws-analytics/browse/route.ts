import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSuperAdminSession } from '@/lib/auth';
import { browseBucketPrefix, getAwsAnalytics } from '@/lib/aws-analytics.server';

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const bucket = (searchParams.get('bucket') || '').trim();
    const prefix = (searchParams.get('prefix') || '').trim();
    const company = (searchParams.get('company') || '').trim() || undefined;
    if (!bucket) {
      return NextResponse.json({ error: 'bucket query param is required' }, { status: 400 });
    }

    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' }, { status: 500 });
    }

    // Root of a bucket is served from the already-scanned account-wide cache
    // (or triggers that single scan) — no extra S3 calls needed for the top level.
    // Company-filtered browsing always does a live scoped scan since the cache
    // only holds whole-bucket aggregates, not per-company folder structure.
    if (!prefix && !company) {
      const analytics = await getAwsAnalytics(db);
      const bucketStats = analytics.buckets.find((b) => b.name === bucket);
      if (!bucketStats) {
        return NextResponse.json({ error: 'Bucket not found or not accessible' }, { status: 404 });
      }
      return NextResponse.json({
        bucket,
        prefix: '',
        folders: bucketStats.folders.map((f) => ({
          name: f.folder,
          prefix: `${f.folder}/`,
          objects: f.objects,
          bytes: f.bytes,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
        files: bucketStats.rootFiles,
        truncated: bucketStats.truncated,
      });
    }

    const result = await browseBucketPrefix(bucket, prefix, company);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[aws-analytics/browse]', err);
    return NextResponse.json({ error: 'Failed to browse bucket' }, { status: 500 });
  }
}
