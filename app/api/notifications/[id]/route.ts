import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminNotification from '@/lib/models/AdminNotification';
import { getServerSession } from '@/lib/auth';
import { notificationFilterForSession } from '@/lib/admin-notification-filter.util';

async function findScopedNotification(id: string, session: Awaited<ReturnType<typeof getServerSession>>) {
  const sessionFilter = notificationFilterForSession(session!);
  const query: Record<string, unknown> = { _id: id };
  if (sessionFilter) {
    Object.assign(query, sessionFilter);
  }
  return AdminNotification.findOne(query).lean();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  await dbConnect();

  try {
    const body = await request.json();
    const { isRead } = body;

    const updateData: Record<string, unknown> = {};

    if (typeof isRead === 'boolean') {
      updateData.isRead = isRead;
      updateData.readAt = isRead ? new Date() : null;
    }

    const notification = await findScopedNotification(id, session);
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const updated = await AdminNotification.findByIdAndUpdate(id, updateData, {
      new: true,
    }).lean();

    return NextResponse.json({ notification: updated });
  } catch (error: unknown) {
    console.error('Error updating admin notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  await dbConnect();

  try {
    const notification = await findScopedNotification(id, session);
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await AdminNotification.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Notification deleted' });
  } catch (error: unknown) {
    console.error('Error deleting admin notification:', error);
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
  }
}
