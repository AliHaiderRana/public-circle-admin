import { NextResponse } from 'next/server';
import { requireSuperAdminSession, toAdminAuditSession } from '@/lib/auth';
import { getBackendApiUrl, getBackendAuthHeaders } from '@/lib/backend-api.server';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

export type DlqStatus = {
  dlqMessageCount: number | null;
  countError: string | null;
  dlqLastAlertAt: string | null;
  dlqLastAlertedCount: number;
  dlqAlertEmails: string[];
  defaultAlertEmail: string | null;
  environment: string | null;
};

async function fetchDlqStatus(): Promise<DlqStatus> {
  const response = await fetch(`${getBackendApiUrl()}/system/dlq`, {
    headers: await getBackendAuthHeaders(),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Failed to fetch DLQ status');
  }

  return payload.data as DlqStatus;
}

export async function GET() {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const data = await fetchDlqStatus();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch DLQ status' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const body = await request.json();
    const response = await fetch(`${getBackendApiUrl()}/system/dlq`, {
      method: 'PATCH',
      headers: await getBackendAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.message || payload.error || 'Failed to update DLQ settings' },
        { status: response.status },
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.DLQ_SETTINGS_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.DLQ,
        resourceType: 'dlq',
        details: {
          dlqAlertEmails: payload.data?.dlqAlertEmails || [],
        },
      });
    }

    const status = await fetchDlqStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update DLQ settings' },
      { status: 500 },
    );
  }
}
