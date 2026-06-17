import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';
import { canAdminAccessTicket } from '@/lib/support-access.util';

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

  try {
    await dbConnect();
    const ticket = await SupportRequest.findById(id).select('assignedAdminId').lean();
    if (!ticket) {
      return NextResponse.json({ error: 'Support request not found' }, { status: 404 });
    }
    if (!canAdminAccessTicket(session, ticket)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const response = await internalApiFetch(`/support-requests/${id}/attachment-upload-url`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || payload?.error || 'Failed to prepare image upload' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload.data ?? payload);
  } catch {
    return NextResponse.json({ error: 'Failed to prepare image upload' }, { status: 500 });
  }
}
