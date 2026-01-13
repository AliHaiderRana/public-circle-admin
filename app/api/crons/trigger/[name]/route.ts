import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

const SERVER_API_URL = process.env.SERVER_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal_admin_cron_key_2024';

/**
 * POST /api/crons/trigger/[name]
 * Trigger a specific cron job via the server API
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await params;

  if (!name) {
    return NextResponse.json({ error: 'Cron name is required' }, { status: 400 });
  }

  try {
    // Call the server API to trigger the cron using internal API key
    const response = await fetch(`${SERVER_API_URL}/crons/trigger/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': INTERNAL_API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to trigger cron' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: data.message || `Cron '${name}' triggered successfully`,
      data: data.data,
    });
  } catch (error: any) {
    console.error(`[API] Error triggering cron ${name}:`, error);
    return NextResponse.json(
      { error: 'Failed to trigger cron', details: error.message },
      { status: 500 }
    );
  }
}
