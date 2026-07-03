import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import {
  getManagedIntegrationSettings,
  saveAdminPortalIntegration,
  saveManagedIntegrationSettings,
  savePublicCircleServerIntegration,
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

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const scope = body?.scope as string | undefined;

    if (scope === 'adminPortal') {
      const { scope: _scope, adminPortal, ...rest } = body as {
        scope?: string;
        adminPortal?: Record<string, unknown>;
        [key: string]: unknown;
      };
      const settings = await saveAdminPortalIntegration(
        (adminPortal ?? rest) as Parameters<typeof saveAdminPortalIntegration>[0],
      );
      return NextResponse.json(settings);
    }

    if (scope === 'publicCircleServer') {
      const { scope: _scope, publicCircleServer, ...rest } = body as {
        scope?: string;
        publicCircleServer?: Record<string, unknown>;
        [key: string]: unknown;
      };
      const settings = await savePublicCircleServerIntegration(
        (publicCircleServer ?? rest) as Parameters<typeof savePublicCircleServerIntegration>[0],
      );
      return NextResponse.json(settings);
    }

    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  } catch (error) {
    console.error('[integrations] PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to save integration settings' }, { status: 500 });
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
