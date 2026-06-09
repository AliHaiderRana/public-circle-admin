import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { internalApiFetch } from '@/lib/internal-api.server';

type CachedStats = {
  data: Record<string, unknown>;
  expiresAt: number;
};

let statsCache: CachedStats | null = null;
const CACHE_TTL_MS = 15000;

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  if (statsCache && statsCache.expiresAt > now) {
    return NextResponse.json(statsCache.data);
  }

  try {
    const response = await internalApiFetch('/support-chat/stats', {
      timeoutMs: 12000,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || payload?.error || 'Failed to fetch support stats' },
        { status: response.status },
      );
    }

    const data = payload?.data ?? payload;
    statsCache = {
      data,
      expiresAt: now + CACHE_TTL_MS,
    };

    return NextResponse.json(data);
  } catch (error) {
    if (statsCache) {
      return NextResponse.json(statsCache.data);
    }

    console.error('[support-stats] fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch support stats' },
      { status: 500 },
    );
  }
}
