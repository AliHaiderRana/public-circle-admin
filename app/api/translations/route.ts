import { NextResponse } from 'next/server';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  params.set('prefix', searchParams.get('prefix') || 'dashboard');
  params.set('page', searchParams.get('page') || '1');
  params.set('limit', searchParams.get('limit') || '10');
  const search = searchParams.get('search');
  if (search) params.set('search', search);
  const searchScope = searchParams.get('searchScope');
  if (searchScope) params.set('searchScope', searchScope);

  try {
    const res = await fetch(`${API_BASE_URL}/translations?${params}`, {
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to fetch translations' },
        { status: res.status }
      );
    }

    const data = body.data ?? {};
    return NextResponse.json({
      prefix: data.prefix,
      search: data.search,
      searchScope: data.searchScope,
      translations: data.translations ?? [],
      pagination: data.pagination,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const res = await fetch(`${API_BASE_URL}/translations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to create' },
        { status: res.status }
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.TRANSLATION_CREATE,
        category: ADMIN_AUDIT_CATEGORY.TRANSLATION,
        resourceType: 'translation',
        resourceId: body.data?.key ?? payload?.key,
        details: {
          key: payload?.key ?? body.data?.key,
          locale: payload?.locale,
        },
      });
    }

    return NextResponse.json(
      { translation: body.data },
      { status: res.status }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const res = await fetch(`${API_BASE_URL}/translations`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to save' },
        { status: res.status }
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.TRANSLATION_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.TRANSLATION,
        resourceType: 'translation',
        resourceId: payload?.key ?? body.data?.key,
        details: { key: payload?.key ?? body.data?.key, locale: payload?.locale },
      });
    }

    return NextResponse.json({ translation: body.data });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/translations?key=${encodeURIComponent(key)}`,
      { method: 'DELETE' }
    );
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to delete' },
        { status: res.status }
      );
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.TRANSLATION_DELETE,
        category: ADMIN_AUDIT_CATEGORY.TRANSLATION,
        resourceType: 'translation',
        resourceId: body.data?.key ?? key,
        details: { key: body.data?.key ?? key },
      });
    }

    return NextResponse.json({ message: 'Deleted', key: body.data?.key ?? key });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
