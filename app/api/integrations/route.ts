import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import {
  getManagedIntegrationSettings,
  saveManagedIntegrationSettings,
} from '@/lib/integration-settings-admin.service';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const settings = await getManagedIntegrationSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[integrations] GET failed:', error);
    return NextResponse.json({ error: 'Failed to load integrations' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const settings = await saveManagedIntegrationSettings(body);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[integrations] PUT failed:', error);
    return NextResponse.json({ error: 'Failed to save integrations' }, { status: 500 });
  }
}
