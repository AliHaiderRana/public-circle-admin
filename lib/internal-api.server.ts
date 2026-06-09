const SERVER_API_URL =
  process.env.SERVER_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';

const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || 'internal_admin_cron_key_2024';

export async function internalApiFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = 15000, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${SERVER_API_URL}/internal${path}`, {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': INTERNAL_API_KEY,
        ...(fetchInit.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
