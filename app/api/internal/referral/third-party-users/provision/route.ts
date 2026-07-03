import { NextResponse } from 'next/server';
import { verifyReferralBackendInternalAuth } from '@/lib/referral-backend-internal-auth.server';
import { isPartnerHandoffEnabled } from '@/lib/partner-handoff-settings.server';
import { internalApiFetch } from '@/lib/internal-api.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = await verifyReferralBackendInternalAuth(request);
  if (authError) return authError;

  if (!(await isPartnerHandoffEnabled())) {
    return NextResponse.json({ error: 'Partner portal handoff is disabled' }, { status: 403 });
  }

  let body: { referralUserId?: string; requireSignupComplete?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const referralUserId = body.referralUserId?.trim();
  if (!referralUserId) {
    return NextResponse.json({ error: 'referralUserId is required' }, { status: 400 });
  }

  try {
    const response = await internalApiFetch('/third-party-users/provision', {
      method: 'POST',
      body: JSON.stringify({
        referralUserId,
        requireSignupComplete:
          body.requireSignupComplete === undefined ? true : Boolean(body.requireSignupComplete),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.message || 'Provision failed', data: payload?.data },
        { status: response.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[internal/referral/third-party-users/provision] failed:', error);
    return NextResponse.json({ error: 'Failed to provision third-party user' }, { status: 500 });
  }
}
