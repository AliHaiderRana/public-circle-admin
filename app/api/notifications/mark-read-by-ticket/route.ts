import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';
import {
  markSupportTicketSeenInAdminDb,
  normalizeSupportRequestId,
} from '@/lib/support-ticket-read.util';
import { invalidateSupportStatsCache } from '@/lib/support-stats-cache.server';

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supportRequestId = normalizeSupportRequestId(body?.supportRequestId);

    if (!supportRequestId) {
      return NextResponse.json({ error: 'supportRequestId is required' }, { status: 400 });
    }

    const [result] = await Promise.all([
      markSupportTicketSeenInAdminDb(supportRequestId),
      internalApiFetch(`/support-requests/${supportRequestId}/mark-seen-admin`, {
        method: 'POST',
      }).catch((error) => {
        console.warn('[mark-read-by-ticket] server mark-seen failed:', error);
        return null;
      }),
    ]);
    invalidateSupportStatsCache();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error marking ticket notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 },
    );
  }
}
