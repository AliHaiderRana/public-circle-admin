import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';
import { formatAdminDisplayName } from '@/lib/support-admin.util';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit');
  const before = searchParams.get('before');
  const query = new URLSearchParams();
  if (limit) query.set('limit', limit);
  if (before) query.set('before', before);
  const queryString = query.toString();

  try {
    const response = await internalApiFetch(
      `/support-requests/${id}/messages${queryString ? `?${queryString}` : ''}`,
      { timeoutMs: 15000 },
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || payload?.error || 'Failed to fetch messages' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload.data ?? payload);
  } catch (error) {
    console.error('[support-messages] fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const internal = Boolean(body.internal);

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  try {
    const adminDisplayName = formatAdminDisplayName(session.name, session.email);
    const response = await internalApiFetch(`/support-requests/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        internal,
        adminId: session.userId,
        adminName: adminDisplayName,
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
