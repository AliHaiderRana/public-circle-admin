import { NextResponse } from 'next/server';
import { getIntegrationSettings } from '@/lib/integration-settings.service';
import { isReferralBackendAllowedInternalRoute } from '@/lib/referral-app-integration.allowlist';

export async function verifyReferralBackendInternalAuth(
  request: Request,
): Promise<NextResponse | null> {
  const url = new URL(request.url);
  if (!isReferralBackendAllowedInternalRoute(request.method, url.pathname)) {
    return NextResponse.json(
      {
        error:
          'This admin API is not part of the Venndii Referral App integration allowlist. Only routes documented on referral Integrations may be used.',
      },
      { status: 403 },
    );
  }

  const settings = await getIntegrationSettings();
  const expected = settings.adminPortal.referralBackendApiKey?.trim();

  if (!expected) {
    return NextResponse.json(
      { error: 'Referral backend API key is not configured' },
      { status: 503 },
    );
  }

  const apiKey = request.headers.get('x-referral-backend-api-key');
  if (!apiKey || apiKey !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
