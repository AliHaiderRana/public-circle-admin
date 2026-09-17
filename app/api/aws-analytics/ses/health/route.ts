import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/auth';
import { getSesAnalytics } from '@/lib/ses-analytics.server';
import { getOverallHealthStatus } from '@/lib/ses-health';

export async function GET() {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const analytics = await getSesAnalytics();
    const bounceRate = analytics.reputation.bounceRate ?? 0;
    const complaintRate = analytics.reputation.complaintRate ?? 0;
    const health = getOverallHealthStatus(
      bounceRate,
      complaintRate,
      analytics.sendingEnabled
    );

    return NextResponse.json({
      ...health,
      bounceRate,
      complaintRate,
      sendingEnabled: analytics.sendingEnabled,
      unavailableReason: analytics.reputation.unavailableReason,
    });
  } catch (err) {
    console.error('[aws-analytics/ses/health]', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message.includes('credentials')
            ? err.message
            : 'Failed to load SES health',
      },
      { status: 500 }
    );
  }
}
