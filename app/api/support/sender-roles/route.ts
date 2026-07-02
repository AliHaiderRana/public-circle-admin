import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { resolveSenderRoleLabelsForAdminIds } from '@/lib/support-message-sender.util';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ids = searchParams
    .get('ids')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!ids?.length) {
    return NextResponse.json({ roles: {} });
  }

  try {
    await dbConnect();
    const roleById = await resolveSenderRoleLabelsForAdminIds(ids);
    return NextResponse.json({ roles: Object.fromEntries(roleById) });
  } catch {
    return NextResponse.json({ error: 'Failed to resolve sender roles' }, { status: 500 });
  }
}
