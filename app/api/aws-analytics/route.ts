import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSuperAdminSession } from '@/lib/auth';
import { getAwsAnalytics } from '@/lib/aws-analytics.server';

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === '1';

    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' }, { status: 500 });
    }

    const analytics = await getAwsAnalytics(db, forceRefresh);
    return NextResponse.json(analytics);
  } catch (err) {
    console.error('[aws-analytics]', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message.includes('credentials')
            ? err.message
            : 'Failed to load AWS analytics',
      },
      { status: 500 }
    );
  }
}
