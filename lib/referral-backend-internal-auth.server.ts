import { NextResponse } from 'next/server';
import { getIntegrationSettings } from '@/lib/integration-settings.service';

export async function verifyReferralBackendInternalAuth(
  request: Request,
): Promise<NextResponse | null> {
  const settings = await getIntegrationSettings();
  const expected =
    settings.adminPortal.referralBackendApiKey?.trim() ||
    process.env.REFERRAL_BACKEND_API_KEY?.trim();

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
