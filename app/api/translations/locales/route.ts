import { NextResponse } from 'next/server';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import dbConnect from '@/lib/db';
import { syncDescriptionsForNewLocale } from '@/lib/ui-term-defaults';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/translations/locales?admin=true`, {
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to fetch locales' },
        { status: res.status }
      );
    }

    return NextResponse.json({
      locales: body.data?.locales ?? [],
      defaultLocale: body.data?.defaultLocale ?? 'en-US',
    });
  } catch {
    return NextResponse.json(
      {
        error: 'Failed to connect to backend',
        hint: `Start the API server (expected at ${API_BASE_URL}). From the server folder: npm run dev`,
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const res = await fetch(`${API_BASE_URL}/translations/locales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to add language' },
        { status: res.status }
      );
    }

    const code = String(payload.code ?? '').trim();
    // Keep add-language response snappy; run UI-term sync in background.
    void (async () => {
      try {
        await dbConnect();
        await syncDescriptionsForNewLocale({ code });
      } catch (syncErr) {
        console.error(
          '[translations/locales] background ui-term sync failed:',
          syncErr,
        );
      }
    })();

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.LOCALE_CREATE,
        category: ADMIN_AUDIT_CATEGORY.TRANSLATION,
        resourceType: 'locale',
        resourceId: code || body.data?.code,
        details: { code: code || body.data?.code, label: payload?.label },
      });
    }

    return NextResponse.json(
      {
        locale: body.data,
        warning:
          'Language added. UI-term sync is running in background and may take a moment.',
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
