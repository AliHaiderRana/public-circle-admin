import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminNotification from '@/lib/models/AdminNotification';
import { getServerSession } from '@/lib/auth';

export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    await AdminNotification.updateMany(
      { isRead: false },
      { 
        isRead: true,
        readAt: new Date()
      }
    );

    return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}
