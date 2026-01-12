import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import EmailsSent from '@/lib/models/EmailsSent';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthEmails, lastMonthEmails, totalEmails] = await Promise.all([
      EmailsSent.countDocuments({ createdAt: { $gte: startOfMonth } }),
      EmailsSent.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      EmailsSent.countDocuments({})
    ]);

    const emailGrowth = lastMonthEmails > 0 
      ? ((thisMonthEmails - lastMonthEmails) / lastMonthEmails * 100).toFixed(1)
      : '0';

    return NextResponse.json({
      thisMonthEmails,
      lastMonthEmails,
      totalEmails,
      emailGrowth: parseFloat(emailGrowth)
    });
  } catch (error) {
    console.error('Error fetching email stats:', error);
    return NextResponse.json({ error: 'Failed to fetch email stats' }, { status: 500 });
  }
}
