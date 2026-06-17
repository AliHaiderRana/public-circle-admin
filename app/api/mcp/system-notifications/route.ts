import { NextResponse } from 'next/server';
import {
  getSystemNotifications,
  updateSystemNotifications,
} from '@/lib/system-notifications.server';

const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || 'internal_admin_cron_key_2024';

function isAuthorized(request: Request) {
  const key =
    request.headers.get('x-internal-api-key') ||
    request.headers.get('X-Internal-API-Key');
  return key === INTERNAL_API_KEY;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await getSystemNotifications();
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch system notifications' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = await updateSystemNotifications(body);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Failed to update system notifications' }, { status: 500 });
  }
}
