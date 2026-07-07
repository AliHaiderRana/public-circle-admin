import { NextResponse } from 'next/server';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { getAdminLocalCronDefinition } from '@/lib/admin-cron-definitions';
import { runAdminLocalCronInBackground } from '@/lib/admin-cron-runner.server';
import { getBackendApiUrl, getBackendAuthHeaders } from '@/lib/backend-api.server';
import { assertSuperAdminDlqAccess } from '@/lib/dlq-access';

/**
 * POST /api/crons/trigger/[name]
 * Trigger a specific cron job via the server API
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await params;

  if (!name) {
    return NextResponse.json({ error: 'Cron name is required' }, { status: 400 });
  }

  const dlqAccess = assertSuperAdminDlqAccess(name, session.isSuperAdmin);
  if (!dlqAccess.allowed) {
    return NextResponse.json({ error: dlqAccess.error }, { status: 403 });
  }

  const localCron = getAdminLocalCronDefinition(name);
  if (localCron) {
    runAdminLocalCronInBackground(name);

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.CRON_TRIGGER,
        category: ADMIN_AUDIT_CATEGORY.CRON,
        resourceType: 'cron',
        resourceId: name,
        details: { cronName: name, source: 'admin' },
      });
    }

    return NextResponse.json({
      message: `Cron '${name}' triggered successfully. It will run in the background.`,
      data: { name, triggered: true, source: 'admin' },
    });
  }

  try {
    // Call the server API to trigger the cron using internal API key
    const response = await fetch(`${await getBackendApiUrl()}/crons/trigger/${name}`, {
      method: 'POST',
      headers: await getBackendAuthHeaders({
        'Content-Type': 'application/json',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to trigger cron' },
        { status: response.status }
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.CRON_TRIGGER,
        category: ADMIN_AUDIT_CATEGORY.CRON,
        resourceType: 'cron',
        resourceId: name,
        details: { cronName: name },
      });
    }

    return NextResponse.json({
      message: data.message || `Cron '${name}' triggered successfully`,
      data: data.data,
    });
  } catch (error: any) {
    console.error(`[API] Error triggering cron ${name}:`, error);
    return NextResponse.json(
      { error: 'Failed to trigger cron', details: error.message },
      { status: 500 }
    );
  }
}
