import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/translations/admin-config`, {
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to fetch config' },
        { status: res.status }
      );
    }
    return NextResponse.json({ config: body.data });
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

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const res = await fetch(`${API_BASE_URL}/translations/admin-config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: body.message || 'Failed to save config' },
        { status: res.status }
      );
    }
    return NextResponse.json({ config: body.data });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
