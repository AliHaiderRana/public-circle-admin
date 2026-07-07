import { getBackendApiUrl, getBackendAuthHeaders } from '@/lib/backend-api.server';

export async function internalApiFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = 15000, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${await getBackendApiUrl()}/internal${path}`, {
      ...fetchInit,
      signal: controller.signal,
      headers: await getBackendAuthHeaders({
        'Content-Type': 'application/json',
        ...(fetchInit.headers || {}),
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
}
