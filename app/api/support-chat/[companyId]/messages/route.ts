import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit');
  const before = searchParams.get('before');
  const query = new URLSearchParams();
  if (limit) query.set('limit', limit);
  if (before) query.set('before', before);
  const queryString = query.toString();

  try {
    const response = await internalApiFetch(
      `/support-chat/${companyId}/messages${queryString ? `?${queryString}` : ''}`,
    );
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to fetch messages' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload.data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await params;
  const body = await request.json();
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  try {
    const response = await internalApiFetch(`/support-chat/${companyId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        adminId: session.userId,
        adminName: session.name || '',
        adminEmail: session.email || '',
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to send message' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
