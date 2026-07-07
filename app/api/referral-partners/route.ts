import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/auth';
import { listReferralSupportPartners } from '@/lib/referral-partner.service';

export async function GET() {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const partners = await listReferralSupportPartners();
    return NextResponse.json({ partners });
  } catch (err) {
    console.error('[referral-partners]', err);
    return NextResponse.json({ error: 'Failed to load support partners' }, { status: 500 });
  }
}
