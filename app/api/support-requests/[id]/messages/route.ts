import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';
import { formatAdminDisplayName } from '@/lib/support-admin.util';
import { canAdminAccessTicket } from '@/lib/support-access.util';
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
    await dbConnect();
    const ticket = await SupportRequest.findById(id).select('assignedAdminId').lean();
    if (!ticket) {
      return NextResponse.json({ error: 'Support request not found' }, { status: 404 });
    }
    if (!canAdminAccessTicket(session, ticket)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const data = payload.data ?? payload;

    return NextResponse.json(data);
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
  const attachment = body.attachment;

  if (!message && !attachment) {
    return NextResponse.json({ error: 'Message or image is required' }, { status: 400 });
  }

  try {
    await dbConnect();
    const ticket = await SupportRequest.findById(id).select('assignedAdminId').lean();
    if (!ticket) {
      return NextResponse.json({ error: 'Support request not found' }, { status: 404 });
    }
    if (!canAdminAccessTicket(session, ticket)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminDisplayName = formatAdminDisplayName(session.name, session.email);
    const response = await internalApiFetch(`/support-requests/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        internal,
        attachment,
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
