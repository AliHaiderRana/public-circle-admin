import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminNotification from '@/lib/models/AdminNotification';
import { getServerSession } from '@/lib/auth';
import { notificationFilterForSession } from '@/lib/admin-notification-filter.util';

export async function POST() {
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

    await AdminNotification.updateMany(query, {
      isRead: true,
      readAt: new Date(),
    });

    return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error: unknown) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 },
    );
  }
}
