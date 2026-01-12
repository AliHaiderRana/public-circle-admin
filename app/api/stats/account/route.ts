import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const [companyCount, activeCompanyCount, userCount, activeUserCount] = await Promise.all([
      Company.countDocuments({}),
      Company.countDocuments({ status: 'ACTIVE' }),
      User.countDocuments({}),
      User.countDocuments({ status: 'ACTIVE' })
    ]);

    return NextResponse.json({
      companyCount,
      activeCompanyCount,
      userCount,
      activeUserCount
    });
  } catch (error) {
    console.error('Error fetching account stats:', error);
    return NextResponse.json({ error: 'Failed to fetch account stats' }, { status: 500 });
  }
}
