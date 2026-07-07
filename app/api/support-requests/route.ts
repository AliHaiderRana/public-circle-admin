import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import { getServerSession } from '@/lib/auth';
import { toAdminAuditSession } from '@/lib/auth';
import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import {
  formatSupportReferenceId,
  parseTicketIdSearchSuffix,
} from '@/lib/support-admin.util';
import {
  isPartnerSession,
  ticketsFilterForSession,
  canSessionAccessTicket,
} from '@/lib/partner-access.util';
import { getReferralPartnersByCompanyIds } from '@/lib/referral-partner.service';
import { logPartnerPortalActivity, PARTNER_PORTAL_ACTIONS } from '@/lib/partner-activity';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '25', 10), 1),
      100,
    );
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const unassignedOnly = searchParams.get('unassignedOnly') === 'true';
    const category = searchParams.get('category') || '';

    const query: Record<string, unknown> = {
      ...(await ticketsFilterForSession(session)),
    };

    if (activeOnly && !isPartnerSession(session)) {
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

    if (unassignedOnly && !isPartnerSession(session)) {
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        { $or: [{ assignedAdminId: null }, { assignedAdminId: { $exists: false } }] },
      ];
    } else if (session.isSuperAdmin && !isPartnerSession(session)) {
      const assignedAdminId = searchParams.get('assignedAdminId') || '';
      if (assignedAdminId) {
        query.assignedAdminId = assignedAdminId;
      }
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
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportRequest.countDocuments(query),
    ]);

    const requestsWithReference = requests.map((request) => ({
      ...request,
      referenceId: formatSupportReferenceId(String(request._id)),
    }));

    if (session.isSuperAdmin && !isPartnerSession(session)) {
      const companyIds = requestsWithReference
        .map((request) => {
          const company = request.companyId as { _id?: unknown } | unknown;
          if (company && typeof company === 'object' && '_id' in company) {
            return String(company._id);
          }
          return request.companyId ? String(request.companyId) : '';
        })
        .filter(Boolean);
      const partnersByCompany = await getReferralPartnersByCompanyIds(companyIds);
      const enriched = requestsWithReference.map((request) => {
        const company = request.companyId as { _id?: unknown } | unknown;
        const companyId =
          company && typeof company === 'object' && '_id' in company
            ? String(company._id)
            : request.companyId
              ? String(request.companyId)
              : '';
        return {
          ...request,
          linkedReferralPartners: companyId ? partnersByCompany[companyId] ?? [] : [],
        };
      });

      return NextResponse.json({
        requests: enriched,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      });
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logPartnerPortalActivity(auditSession, {
        action: PARTNER_PORTAL_ACTIONS.VIEW_SUPPORT_REQUESTS,
        resourceType: 'support_request',
        details: {
          page,
          limit,
          search: search || undefined,
          status: status || undefined,
          activeOnly,
          category: category || undefined,
          totalCount,
        },
        summary: `Partner viewed support requests (${totalCount} total)`,
      });
    }

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
