import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-12-18.acacia' });

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [balance, charges, products, subscriptions] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.charges.list({ limit: 10 }),
      stripe.products.list({ active: true, limit: 100 }),
      stripe.subscriptions.list({ limit: 100 })
    ]);

    const now = Date.now();
    const dayStart = now - 24 * 60 * 60 * 1000;
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = now - 30 * 24 * 60 * 60 * 1000;
    const yearStart = now - 365 * 24 * 60 * 60 * 1000;

    const sales = charges.data.reduce((acc, charge) => {
      if (charge.status === 'succeeded') {
        const created = charge.created * 1000;
        if (created >= dayStart) acc.today += charge.amount;
        if (created >= weekStart) acc.week += charge.amount;
        if (created >= monthStart) acc.month += charge.amount;
        if (created >= yearStart) acc.year += charge.amount;
      }
      return acc;
    }, { today: 0, week: 0, month: 0, year: 0 });

    const recentTransactions = charges.data.slice(0, 10).map(charge => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      description: charge.description || 'Payment',
      created: new Date(charge.created * 1000),
      customer: charge.billing_details?.name || charge.customer?.toString() || 'Unknown'
    }));

    const subscriptionStats = subscriptions.data.reduce((acc, sub) => {
      if (sub.status === 'active') acc.active++;
      if (sub.status === 'trialing') acc.trial++;
      if (sub.status === 'canceled') acc.canceled++;
      if (sub.status === 'active' && sub.items.data[0]?.price?.unit_amount) {
        acc.totalRevenue += sub.items.data[0].price.unit_amount;
      }
      return acc;
    }, { active: 0, trial: 0, canceled: 0, totalRevenue: 0 });

    return NextResponse.json({
      data: {
        balance,
        sales,
        recentTransactions,
        subscriptions: subscriptionStats
      },
      message: 'Stripe data fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching Stripe data:', error);
    return NextResponse.json({ error: 'Failed to fetch Stripe data' }, { status: 500 });
  }
}
