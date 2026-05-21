import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  params.set('prefix', searchParams.get('prefix') || 'dashboard');
  params.set('page', searchParams.get('page') || '1');
  params.set('limit', searchParams.get('limit') || '10');
  const search = searchParams.get('search');
  if (search) params.set('search', search);

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
      translations: data.translations ?? [],
      pagination: data.pagination,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    return NextResponse.json({ translation: body.data });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    return NextResponse.json({ message: 'Deleted', key: body.data?.key ?? key });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
