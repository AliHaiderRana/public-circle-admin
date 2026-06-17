import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await params;

  try {
    const response = await internalApiFetch(`/support-chat/${companyId}/read`, {
      method: 'PATCH',
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to mark thread as read' },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to mark thread as read' }, { status: 500 });
  }
}
