import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminNotification from '@/lib/models/AdminNotification';
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
    const isRead = searchParams.get('isRead');

    const skip = (page - 1) * limit;

    const query: any = {};
    
    if (isRead !== null && isRead !== undefined && isRead !== '') {
      query.isRead = isRead === 'true';
    }

    const [notifications, totalCount, unreadCount] = await Promise.all([
      AdminNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminNotification.countDocuments(query),
      AdminNotification.countDocuments({ isRead: false }),
    ]);

    return NextResponse.json({
      items: notifications,
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
