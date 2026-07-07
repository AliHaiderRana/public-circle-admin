import { NextResponse } from 'next/server';
import { verifyReferralBackendInternalAuth } from '@/lib/referral-backend-internal-auth.server';
import { isPartnerHandoffEnabled } from '@/lib/partner-handoff-settings.server';
import { getReferralPartnerSupportStats } from '@/lib/referral-partner-stats.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ referralUserId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const authError = await verifyReferralBackendInternalAuth(request);
  if (authError) return authError;

  if (!(await isPartnerHandoffEnabled())) {
    return NextResponse.json({ error: 'Partner portal handoff is disabled' }, { status: 403 });
  }

  const { referralUserId } = await context.params;
  if (!referralUserId?.trim()) {
    return NextResponse.json({ error: 'referralUserId is required' }, { status: 400 });
  }

  try {
    const data = await getReferralPartnerSupportStats(referralUserId.trim());
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[internal/referral/partner-support-stats] failed:', error);
    return NextResponse.json({ error: 'Failed to fetch partner support stats' }, { status: 500 });
  }
}
