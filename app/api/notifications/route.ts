import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { notificationFilterForSession } from '@/lib/admin-notification-filter.util';
import AdminNotification from '@/lib/models/AdminNotification';
const DROPDOWN_NOTIFICATION_LIMIT = 5;

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || String(DROPDOWN_NOTIFICATION_LIMIT), 10), 1),
      20,
    );
    const isRead = searchParams.get('isRead');

    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    const sessionFilter = notificationFilterForSession(session);
    if (sessionFilter) {
      Object.assign(query, sessionFilter);
    }
    
    if (isRead !== null && isRead !== undefined && isRead !== '') {
      query.isRead = isRead === 'true';
    }

    const unreadQuery: Record<string, unknown> = { isRead: false };
    if (sessionFilter) {
      Object.assign(unreadQuery, sessionFilter);
    }

    const [notifications, totalCount, unreadCount] = await Promise.all([
      AdminNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminNotification.countDocuments(query),
      AdminNotification.countDocuments(unreadQuery),
    ]);

    const displayItems = notifications;

    return NextResponse.json({
      items: displayItems,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      unreadCount,
    });
  } catch (error: any) {
    console.error('Error fetching admin notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
