import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Feedback from '@/lib/models/Feedback';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import { FEEDBACK_STATUS, FEEDBACK_TYPE } from '@/lib/constants';
import { getServerSession } from '@/lib/auth';
import { isPartnerSession } from '@/lib/partner-access.util';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (isPartnerSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';

    const query: Record<string, unknown> = {};

    if (status && Object.values(FEEDBACK_STATUS).includes(status as typeof FEEDBACK_STATUS[keyof typeof FEEDBACK_STATUS])) {
      query.status = status;
    }

    if (type && Object.values(FEEDBACK_TYPE).includes(type as typeof FEEDBACK_TYPE[keyof typeof FEEDBACK_TYPE])) {
      query.type = type;
    }

    if (search) {
      const matchingCompanies = await Company.find({
        name: { $regex: search, $options: 'i' },
      }).select('_id');
      const matchingUsers = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { emailAddress: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');

      query.$or = [
        { companyId: { $in: matchingCompanies.map((company) => company._id) } },
        { userId: { $in: matchingUsers.map((user) => user._id) } },
        { message: { $regex: search, $options: 'i' } },
        { pagePath: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, totalCount] = await Promise.all([
      Feedback.find(query)
        .populate({ path: 'companyId', model: Company, select: 'name' })
        .populate({
          path: 'userId',
          model: User,
          select: 'firstName lastName emailAddress',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Feedback.countDocuments(query),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching product feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product feedback' },
      { status: 500 },
    );
  }
}
