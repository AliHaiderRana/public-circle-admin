import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { isAdminIntegrationsEnabled } from '@/lib/feature-flags';
import {
  buildIntegrationDocs,
  type IntegrationDocsInput,
} from '@/lib/integration-docs.catalog';
import { getManagedIntegrationSettings } from '@/lib/integration-settings-admin.service';

function pickQueryUrl(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key)?.trim();
  return value || undefined;
}

export async function GET(request: Request) {
  if (!isAdminIntegrationsEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const saved = await getManagedIntegrationSettings();

    const input: IntegrationDocsInput = {
      adminPortalUrl: pickQueryUrl(searchParams, 'adminPortalUrl'),
      serverBaseUrl: pickQueryUrl(searchParams, 'serverBaseUrl'),
      adminPortal: {
        enabled: searchParams.has('partnerEnabled')
          ? searchParams.get('partnerEnabled') === 'true'
          : saved.adminPortal.enabled,
        referralEnabled: searchParams.has('referralEnabled')
          ? searchParams.get('referralEnabled') === 'true'
          : saved.adminPortal.referralEnabled,
        adminPortalUrl:
          pickQueryUrl(searchParams, 'adminPortalUrl') ?? saved.adminPortal.adminPortalUrl,
        partnerPortalSsoSecret:
          pickQueryUrl(searchParams, 'partnerPortalSsoSecret') ??
          saved.adminPortal.partnerPortalSsoSecret,
        referralBackendApiKeyConfigured: Boolean(
          saved.adminPortal.referralBackendApiKey?.trim() ||
            process.env.REFERRAL_BACKEND_API_KEY?.trim(),
        ),
      },
      publicCircleServer: {
        enabled: searchParams.has('serverEnabled')
          ? searchParams.get('serverEnabled') === 'true'
          : saved.publicCircleServer.enabled,
        serverBaseUrl:
          pickQueryUrl(searchParams, 'serverBaseUrl') ?? saved.publicCircleServer.serverBaseUrl,
        internalApiKey:
          pickQueryUrl(searchParams, 'internalApiKey') ??
          saved.publicCircleServer.internalApiKey,
      },
    };

    return NextResponse.json(buildIntegrationDocs(input));
  } catch (error) {
    console.error('[integrations/docs] GET failed:', error);
    return NextResponse.json({ error: 'Failed to build integration docs' }, { status: 500 });
  }
}
