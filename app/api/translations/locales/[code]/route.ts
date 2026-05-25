import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { stripLocaleFromAllTerms } from '@/lib/ui-term-defaults';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

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

    return NextResponse.json({ data: body.data });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 502 });
  }
}
