import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';
import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import { assignedTicketsFilterForAdmin } from '@/lib/support-access.util';
import {
  getSupportStatsCache,
  setSupportStatsCache,
} from '@/lib/support-stats-cache.server';

const CACHE_TTL_MS = 15000;

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.isSuperAdmin) {
    try {
      await dbConnect();
      const activeStatuses = [
        SUPPORT_REQUEST_STATUS.OPEN,
        SUPPORT_REQUEST_STATUS.IN_PROGRESS,
      ];
      const assignedFilter = assignedTicketsFilterForAdmin(session);
      const [chatAgg, openSupportRequests] = await Promise.all([
        SupportRequest.aggregate([
          { $match: assignedFilter },
          { $group: { _id: null, unreadChatMessages: { $sum: '$unreadByAdmin' } } },
        ]),
        SupportRequest.countDocuments({
          ...assignedFilter,
          status: { $in: activeStatuses },
        }),
      ]);

      return NextResponse.json({
        unreadChatMessages: chatAgg[0]?.unreadChatMessages ?? 0,
        openSupportRequests,
        unassignedTickets: 0,
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
    return NextResponse.json(statsCache.data);
  }

  try {
    const response = await internalApiFetch('/support-chat/stats', {
      timeoutMs: 12000,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || payload?.error || 'Failed to fetch support stats' },
        { status: response.status },
      );
    }

    const data = payload?.data ?? payload;
    setSupportStatsCache({
      data,
      expiresAt: now + CACHE_TTL_MS,
    });

    return NextResponse.json(data);
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
