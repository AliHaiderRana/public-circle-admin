import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get('prefix') || 'all';

  try {
    const res = await fetch(
      `${API_BASE_URL}/translations/seed?prefix=${encodeURIComponent(prefix)}`,
      { method: 'POST', cache: 'no-store' }
    );
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to sync keys' },
        { status: res.status }
      );
    }

    return NextResponse.json({
      message: body.message,
      data: body.data,
      backend: API_BASE_URL,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
