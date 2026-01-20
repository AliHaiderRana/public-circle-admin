import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Company from '@/lib/models/Company';
import Role from '@/lib/models/Role';
import { getServerSession } from '@/lib/auth';

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

    // Ensure models are registered for populate
    const _Company = Company;
    const _Role = Role;
    
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
    
    const skip = (page - 1) * limit;
    const sortOrder = sort === 'asc' ? 1 : -1;
    
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .populate('company', 'name')
        .populate('role', 'name')
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);
    
    return NextResponse.json({
      users,
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
