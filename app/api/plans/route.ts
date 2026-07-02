import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { denyPartnerPaymentAccess } from '@/lib/partner-access.util';
import Plan, { normalizePlanQuota } from '@/lib/models/Plan';
import { fetchStripePlanPricesByName } from '@/lib/stripe-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const paymentDenied = denyPartnerPaymentAccess(session);
  if (paymentDenied) return paymentDenied;

  await dbConnect();

  try {
    const [rawPlans, stripePricesByName] = await Promise.all([
      Plan.find()
        .select('name quota createdAt updatedAt')
        .lean(),
      fetchStripePlanPricesByName(),
    ]);

    const plans = rawPlans
      .map((plan) => {
        const stripePrice = stripePricesByName[plan.name] ?? null;
        return {
          ...plan,
          quota: normalizePlanQuota(plan.quota as Record<string, unknown>),
          stripePrice,
        };
      })
      .sort((a, b) => {
        const priceA = a.stripePrice?.unitAmount ?? Number.POSITIVE_INFINITY;
        const priceB = b.stripePrice?.unitAmount ?? Number.POSITIVE_INFINITY;
        if (priceA !== priceB) return priceA - priceB;
        return String(a.name).localeCompare(String(b.name));
      });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Failed to fetch plans:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}
