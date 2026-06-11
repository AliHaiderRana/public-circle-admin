import { NextResponse } from 'next/server';
import { runAdminLocalCron } from '@/lib/admin-cron-runner.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || 'internal_admin_cron_key_2024';

/**
 * POST /api/internal/crons/archive-admin-activity
 * Internal endpoint for schedulers (server cron, Vercel cron, etc.)
 */
export async function POST(request: Request) {
  const apiKey = request.headers.get('x-internal-api-key');
  if (!apiKey || apiKey !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runAdminLocalCron('archiveAdminActivity');
    return NextResponse.json({
      message: 'Admin activity archive completed',
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Archive failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
