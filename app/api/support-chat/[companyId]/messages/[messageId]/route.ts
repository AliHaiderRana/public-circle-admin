import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';

type RouteParams = { params: Promise<{ companyId: string; messageId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId, messageId } = await params;
  const body = await request.json();
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  try {
    const response = await internalApiFetch(
      `/support-chat/${companyId}/messages/${messageId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          message,
          adminId: session.userId,
        }),
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to update message' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload.data);
  } catch {
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId, messageId } = await params;

  try {
    const response = await internalApiFetch(
      `/support-chat/${companyId}/messages/${messageId}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ adminId: session.userId }),
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to delete message' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload.data);
  } catch {
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}
