import { NextResponse } from 'next/server';
import { requireSuperAdminSession, toAdminAuditSession } from '@/lib/auth';
import { getBackendApiUrl, getBackendAuthHeaders } from '@/lib/backend-api.server';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

export async function POST() {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const response = await fetch(`${await getBackendApiUrl()}/system/dlq/redrive`, {
      method: 'POST',
      headers: await getBackendAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.message || payload.error || 'Failed to redrive DLQ messages' },
        { status: response.status },
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.DLQ_REDRIVE,
        category: ADMIN_AUDIT_CATEGORY.DLQ,
        resourceType: 'dlq',
        details: payload.data || {},
      });
    }

    return NextResponse.json({
      message: payload.message || 'Messages reverted from DLQ to SQS successfully',
      data: payload.data || {},
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to redrive DLQ messages' },
      { status: 500 },
    );
  }
}
