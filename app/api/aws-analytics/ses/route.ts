import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/auth';
import { getSesAnalytics } from '@/lib/ses-analytics.server';

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === '1';
    const analytics = await getSesAnalytics(forceRefresh);
    return NextResponse.json(analytics);
  } catch (err) {
    console.error('[aws-analytics/ses]', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message.includes('credentials')
            ? err.message
            : 'Failed to load SES analytics',
      },
      { status: 500 }
    );
  }
}
