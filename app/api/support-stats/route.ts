import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import { getServerSession } from '@/lib/auth';
import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import { assignedTicketsFilterForAdmin } from '@/lib/support-access.util';
import {
  isPartnerSession,
  ticketsFilterForSession,
} from '@/lib/partner-access.util';
import {
  getSupportStatsCache,
  setSupportStatsCache,
} from '@/lib/support-stats-cache.server';
import { getPendingCustomerRequestsCount } from '@/lib/customer-request-stats.server';

const CACHE_TTL_MS = 15000;

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isPartnerSession(session)) {
    try {
      await dbConnect();
      const activeStatuses = [
        SUPPORT_REQUEST_STATUS.OPEN,
        SUPPORT_REQUEST_STATUS.IN_PROGRESS,
      ];
      const scopedFilter = await ticketsFilterForSession(session);
      const [chatAgg, openSupportRequests] = await Promise.all([
        SupportRequest.aggregate([
          { $match: scopedFilter },
          { $group: { _id: null, unreadChatMessages: { $sum: '$unreadByAdmin' } } },
        ]),
        SupportRequest.countDocuments({
          ...scopedFilter,
          status: { $in: activeStatuses },
        }),
      ]);

      return NextResponse.json({
        unreadChatMessages: chatAgg[0]?.unreadChatMessages ?? 0,
        openSupportRequests,
        unassignedTickets: 0,
        pendingCustomerRequests: 0,
      });
    } catch (error) {
      console.error('[support-stats] partner fetch failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch support stats' },
        { status: 500 },
      );
    }
  }

  if (!session.isSuperAdmin) {
    try {
      await dbConnect();
      const activeStatuses = [
        SUPPORT_REQUEST_STATUS.OPEN,
        SUPPORT_REQUEST_STATUS.IN_PROGRESS,
      ];
      const scopedFilter = await ticketsFilterForSession(session);
      const [chatAgg, openSupportRequests, pendingCustomerRequests] = await Promise.all([
        SupportRequest.aggregate([
          { $match: scopedFilter },
          { $group: { _id: null, unreadChatMessages: { $sum: '$unreadByAdmin' } } },
        ]),
        SupportRequest.countDocuments({
          ...scopedFilter,
          status: { $in: activeStatuses },
        }),
        isPartnerSession(session) ? Promise.resolve(0) : getPendingCustomerRequestsCount(),
      ]);

      return NextResponse.json({
        unreadChatMessages: chatAgg[0]?.unreadChatMessages ?? 0,
        openSupportRequests,
        unassignedTickets: 0,
        pendingCustomerRequests,
      });
    } catch (error) {
      console.error('[support-stats] scoped fetch failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch support stats' },
        { status: 500 },
      );
    }
  }

  const now = Date.now();
  const statsCache = getSupportStatsCache();
  if (statsCache && statsCache.expiresAt > now) {
    const pendingCustomerRequests = await getPendingCustomerRequestsCount();
    return NextResponse.json({ ...statsCache.data, pendingCustomerRequests });
  }

  try {
    await dbConnect();
    const activeStatuses = [
      SUPPORT_REQUEST_STATUS.OPEN,
      SUPPORT_REQUEST_STATUS.IN_PROGRESS,
    ];
    const [chatAgg, openSupportRequests, unassignedTickets] = await Promise.all([
      SupportRequest.aggregate([
        { $group: { _id: null, unreadChatMessages: { $sum: '$unreadByAdmin' } } },
      ]),
      SupportRequest.countDocuments({ status: { $in: activeStatuses } }),
      SupportRequest.countDocuments({
        status: { $in: activeStatuses },
        $or: [{ assignedAdminId: null }, { assignedAdminId: { $exists: false } }],
      }),
    ]);

    const pendingCustomerRequests = await getPendingCustomerRequestsCount();
    const merged = {
      unreadChatMessages: chatAgg[0]?.unreadChatMessages ?? 0,
      openSupportRequests,
      unassignedTickets,
      pendingCustomerRequests,
    };

    setSupportStatsCache({
      data: merged,
      expiresAt: now + CACHE_TTL_MS,
    });

    return NextResponse.json(merged);
  } catch (error) {
    const cached = getSupportStatsCache();
    if (cached) {
      return NextResponse.json(cached.data);
    }

    console.error('[support-stats] fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch support stats' },
      { status: 500 },
    );
  }
}
