import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getBackendApiUrl, getBackendAuthHeaders } from '@/lib/backend-api.server';
import { assertSuperAdminDlqAccess } from '@/lib/dlq-access';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cronName: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { cronName } = await params;
    const dlqAccess = assertSuperAdminDlqAccess(cronName, session.isSuperAdmin);
    if (!dlqAccess.allowed) {
      return NextResponse.json({ error: dlqAccess.error }, { status: 403 });
    }

    const response = await fetch(`${await getBackendApiUrl()}/crons/${cronName}`, {
      headers: await getBackendAuthHeaders(),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch cron details' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[cron-detail] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
