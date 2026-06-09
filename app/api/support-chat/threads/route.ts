import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';
  const search = searchParams.get('search') || '';

  try {
    const response = await internalApiFetch(
      `/support-chat/threads?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
    );
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to fetch chat threads' },
        { status: response.status },
      );
    }

    return NextResponse.json(payload.data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chat threads' }, { status: 500 });
  }
}
