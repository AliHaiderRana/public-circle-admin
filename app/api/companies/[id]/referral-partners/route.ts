import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from '@/lib/auth';
import { isPartnerSession } from '@/lib/partner-access.util';
import { getReferralPartnersForCompany } from '@/lib/referral-partner.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isPartnerSession(session) || !session.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
    }

    const partners = await getReferralPartnersForCompany(id);
    return NextResponse.json({ partners });
  } catch (error) {
    console.error('Error fetching company referral partners:', error);
    return NextResponse.json({ error: 'Failed to fetch referral partners' }, { status: 500 });
  }
}
