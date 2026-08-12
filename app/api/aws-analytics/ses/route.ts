import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/auth';
import {
  getCompanyDailySendStats,
  getSesAnalytics,
} from '@/lib/ses-analytics.server';

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === '1';
    const companyId = (searchParams.get('company') || '').trim();
    const analytics = await getSesAnalytics(forceRefresh);

    if (!companyId) {
      return NextResponse.json(analytics);
    }

    try {
      const companyStats = await getCompanyDailySendStats(companyId);
      return NextResponse.json({
        ...analytics,
        dailyStats: companyStats.dailyStats,
        totalsLast14Days: companyStats.totalsLast14Days,
        scope: 'company',
        companyId,
        companyName: companyStats.companyName,
      });
    } catch (companyErr) {
      const message =
        companyErr instanceof Error ? companyErr.message : 'Invalid company';
      const status =
        message === 'Company not found' || message === 'Invalid company id'
          ? 404
          : 500;
      return NextResponse.json({ error: message }, { status });
    }
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
