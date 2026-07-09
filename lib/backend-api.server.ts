import { getIntegrationSettings } from '@/lib/integration-settings.service';
import { getServerSecrets } from '@/lib/server-secrets.server';

function trimUrl(value: string | undefined): string {
  return value?.trim().replace(/\/$/, '') || '';
}

/** Public Circle server origin — Integration-Settings DB first. */
export async function getBackendApiUrl(): Promise<string> {
  const settings = await getIntegrationSettings();
  const fromIntegration = trimUrl(settings.publicCircleServer.serverBaseUrl);
  if (fromIntegration) {
    return fromIntegration;
  }

  const secrets = await getServerSecrets();
  return trimUrl(secrets.serverBaseUrl);
}

/** Server internal API key — Integration-Settings DB first. */
export async function getBackendInternalApiKey(): Promise<string> {
  const settings = await getIntegrationSettings();
  const fromIntegration = settings.publicCircleServer.internalApiKey?.trim();
  if (fromIntegration) {
    return fromIntegration;
  }

  const secrets = await getServerSecrets();
  return secrets.internalApiKey;
}

export async function getBackendAuthHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const internalApiKey = await getBackendInternalApiKey();
  return {
    'x-internal-api-key': internalApiKey,
    ...extra,
  };
}
