import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Company from '@/lib/models/Company';
import Role from '@/lib/models/Role';
import OnboardingProgress from '@/lib/models/OnboardingProgress';
import { getServerSession } from '@/lib/auth';
import {
  isPartnerSession,
  resolvePartnerCompanyScope,
} from '@/lib/partner-access.util';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'desc';
    const companyId = searchParams.get('companyId') || '';

    // Ensure models are registered for populate
    void Company; void Role; void OnboardingProgress;

    // Build search query
    let query: any = {};
    if (search) {
      const searchTerms = search.trim().split(/\s+/);

      if (searchTerms.length > 1) {
        // Multi-word search: match all terms across firstName/lastName
        query = {
          $or: [
            // Match firstName + lastName combination
            {
              $and: searchTerms.map(term => ({
                $or: [
                  { firstName: { $regex: term, $options: 'i' } },
                  { lastName: { $regex: term, $options: 'i' } }
                ]
              }))
            },
            // Also match email
            { emailAddress: { $regex: search, $options: 'i' } }
          ]
        };
      } else {
        // Single word search
        query = {
          $or: [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { emailAddress: { $regex: search, $options: 'i' } }
          ]
        };
      }
    }

    if (isPartnerSession(session)) {
      const scope = await resolvePartnerCompanyScope(session, companyId || undefined);
      if (scope.forbidden) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      Object.assign(query, scope.filter);
    } else if (companyId) {
      query.company = companyId;
    }
    
    const skip = (page - 1) * limit;
    const sortOrder = sort === 'asc' ? 1 : -1;
    
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .populate('company', 'name')
        .populate('role', 'name')
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);

    // Attach tour step counts to each user
    const userIds = users.map((u: any) => u._id);
    const progressDocs = await OnboardingProgress.find({ user: { $in: userIds } })
      .select('user steps isCompleted isSkipped')
      .lean();

    const progressByUser = new Map(
      progressDocs.map((p: any) => [String(p.user), p])
    );

    const usersWithProgress = users.map((u: any) => {
      const progress = progressByUser.get(String(u._id));
      return {
        ...u,
        tourSteps: progress
          ? {
              total: progress.steps.length,
              completed: progress.steps.filter((s: any) => s.isCompleted).length,
              isCompleted: progress.isCompleted,
              isSkipped: progress.isSkipped,
              steps: progress.steps,
            }
          : null,
      };
    });

    return NextResponse.json({
      users: usersWithProgress,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch users',
      details: error.message
    }, { status: 500 });
  }
}
