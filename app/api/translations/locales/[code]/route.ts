import { NextResponse } from 'next/server';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import dbConnect from '@/lib/db';
import { stripLocaleFromAllTerms } from '@/lib/ui-term-defaults';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;

  try {
    const payload = await request.json();
    const res = await fetch(
      `${API_BASE_URL}/translations/locales/${encodeURIComponent(code)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to update language' },
        { status: res.status }
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.LOCALE_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.TRANSLATION,
        resourceType: 'locale',
        resourceId: code,
        details: {
          code,
          enabled: payload?.enabled,
          label: payload?.label,
          isDefault: payload?.isDefault,
        },
      });
    }

    return NextResponse.json({ locale: body.data });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;

  try {
    const res = await fetch(
      `${API_BASE_URL}/translations/locales/${encodeURIComponent(code)}`,
      { method: 'DELETE' }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to delete language' },
        { status: res.status }
      );
    }

    try {
      await dbConnect();
      await stripLocaleFromAllTerms({ code });
    } catch (syncErr) {
      const message =
        syncErr instanceof Error ? syncErr.message : 'Context help sync failed';
      return NextResponse.json(
        {
          error: `${message}. Language was removed from translations; fix MongoDB or retry.`,
          data: body.data,
        },
        { status: 500 }
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.LOCALE_DELETE,
        category: ADMIN_AUDIT_CATEGORY.TRANSLATION,
        resourceType: 'locale',
        resourceId: code,
        details: { code },
      });
    }

    return NextResponse.json({ data: body.data });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
