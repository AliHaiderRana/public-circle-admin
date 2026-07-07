import { getServerSecrets } from '@/lib/server-secrets.server';

export async function getBackendApiUrl(): Promise<string> {
  const secrets = await getServerSecrets();
  return secrets.serverBaseUrl;
}

export async function getBackendInternalApiKey(): Promise<string> {
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
