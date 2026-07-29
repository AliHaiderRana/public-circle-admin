import { getIntegrationSettings } from '@/lib/integration-settings.service';
import { getServerSecrets } from '@/lib/server-secrets.server';

function trimUrl(value: string | undefined): string {
  return value?.trim().replace(/\/$/, '') || '';
}

/**
 * Public Circle server origin — Integration-Settings DB first.
 * In local development the .env override wins, since the Integration-Settings
 * document lives in the shared staging DB and points at the deployed API.
 */
export async function getBackendApiUrl(): Promise<string> {
  if (process.env.NODE_ENV !== 'production') {
    const fromEnv = trimUrl(process.env.API_BASE_URL || process.env.SERVER_API_URL);
    if (fromEnv) {
      return fromEnv;
    }
  }

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
