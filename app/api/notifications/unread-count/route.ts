import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { notificationFilterForSession } from '@/lib/admin-notification-filter.util';
import AdminNotification from '@/lib/models/AdminNotification';
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const sessionFilter = notificationFilterForSession(session);
    const query: Record<string, unknown> = { isRead: false };
    if (sessionFilter) {
      Object.assign(query, sessionFilter);
    }

    const unreadCount = await AdminNotification.countDocuments(query);

    return NextResponse.json({ unreadCount });
  } catch (error: any) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
}
