import { getServerSecrets } from '@/lib/server-secrets.server';

export function getBackendApiUrl(): string {
  return (
    process.env.API_BASE_URL ||
    process.env.SERVER_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  );
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
