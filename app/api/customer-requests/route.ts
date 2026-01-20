import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CustomerRequest from '@/lib/models/CustomerRequest';
import Company from '@/lib/models/Company';
import { CUSTOMER_REQUEST_TYPE } from '@/lib/constants';
import { getServerSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';

    const allowedTypes = [
      CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_PRIMARY_KEY,
      CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_EMAIL_KEY,
      CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_FILTERS
    ];

    // Build search query
    let query: any = {
      type: { $in: allowedTypes }
    };

    // Type filter
    if (type && allowedTypes.includes(type as any)) {
      query.type = type;
    }

    if (status) {
      query.requestStatus = status;
    }

    const skip = (page - 1) * limit;

    // If search is provided, we need to search by company name
    // First get matching company IDs, then filter requests
    let companyIds: string[] = [];
    if (search) {
      const matchingCompanies = await Company.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id');
      companyIds = matchingCompanies.map(c => c._id.toString());

      query.$or = [
        { companyId: { $in: companyIds } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    const [requests, totalCount] = await Promise.all([
      CustomerRequest.find(query)
        .populate({
          path: 'companyId',
          model: Company
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CustomerRequest.countDocuments(query)
    ]);

    return NextResponse.json({
      requests,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching customer requests:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch customer requests'
    }, { status: 500 });
  }
}
