import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/translations/locales`, {
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

    return NextResponse.json({ locale: body.data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
