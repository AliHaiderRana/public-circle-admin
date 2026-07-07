import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { denyPartnerWrite } from '@/lib/partner-access.util';
import { internalApiFetch } from '@/lib/internal-api.server';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const writeDenied = denyPartnerWrite(session);
  if (writeDenied) return writeDenied;

  const { id, messageId } = await params;

  try {
    const response = await internalApiFetch(
      `/support-requests/${id}/messages/${messageId}/hide-from-customer`,
      { method: 'PATCH' },
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || payload?.error || 'Failed to hide message' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload.data ?? payload);
  } catch (error) {
    console.error('[support-hide-message] failed:', error);
    return NextResponse.json({ error: 'Failed to hide message' }, { status: 500 });
  }
}
