import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import { getServerSession } from '@/lib/auth';
import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import {
  formatSupportReferenceId,
  parseTicketIdSearchSuffix,
} from '@/lib/support-admin.util';

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
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const unassignedOnly = searchParams.get('unassignedOnly') === 'true';
    const category = searchParams.get('category') || '';

    const query: Record<string, unknown> = {};

    if (activeOnly) {
      query.status = {
        $in: [
          SUPPORT_REQUEST_STATUS.OPEN,
          SUPPORT_REQUEST_STATUS.IN_PROGRESS,
          SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION,
        ],
      };
    } else if (status) {
      query.status = status;
    }
    if (category) {
      query.category = category;
    }

    if (unassignedOnly) {
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        { $or: [{ assignedAdminId: null }, { assignedAdminId: { $exists: false } }] },
      ];
    }

    if (search) {
      const matchingCompanies = await Company.find({
        name: { $regex: search, $options: 'i' },
      }).select('_id');
      const companyIds = matchingCompanies.map((c) => c._id);

      const searchOr: Record<string, unknown>[] = [
        { companyId: { $in: companyIds } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];

      const ticketSuffix = parseTicketIdSearchSuffix(search);
      if (ticketSuffix) {
        searchOr.push({
          $expr: {
            $regexMatch: {
              input: { $toString: '$_id' },
              regex: `${ticketSuffix}$`,
              options: 'i',
            },
          },
        });
      }

      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        { $or: searchOr },
      ];
    }

    const skip = (page - 1) * limit;

    const [requests, totalCount] = await Promise.all([
      SupportRequest.find(query)
        .populate({ path: 'companyId', model: Company, select: '_id name' })
        .populate({
          path: 'userId',
          model: User,
          select: 'firstName lastName emailAddress',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportRequest.countDocuments(query),
    ]);

    const requestsWithReference = requests.map((request) => ({
      ...request,
      referenceId: formatSupportReferenceId(String(request._id)),
    }));

    return NextResponse.json({
      requests: requestsWithReference,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching support requests:', error);
    return NextResponse.json({ error: 'Failed to fetch support requests' }, { status: 500 });
  }
}
