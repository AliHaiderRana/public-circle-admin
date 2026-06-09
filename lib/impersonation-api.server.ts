import jwt from 'jsonwebtoken';
import { getServerSecrets } from '@/lib/server-secrets.server';
import type { ImpersonationResult } from '@/lib/impersonation.server';

const API_BASE_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';

export async function createImpersonationViaApi({
  userId,
  companyId,
  adminEmail,
  adminName,
}: {
  userId: string;
  companyId: string;
  adminEmail: string;
  adminName: string;
}): Promise<ImpersonationResult | null> {
  const secrets = await getServerSecrets();
  const signingSecret =
    secrets.adminJwtSecret ||
    process.env.JWT_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-internal-api-key': secrets.internalApiKey,
  };

  if (signingSecret) {
    const adminToken = jwt.sign(
      {
        purpose: 'admin-impersonate',
        adminEmail,
        adminName,
      },
      signingSecret,
      { expiresIn: '60s' }
    );
    headers['x-admin-impersonation-token'] = adminToken;
  }

  const res = await fetch(`${API_BASE_URL}/internal/impersonate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userId,
      companyId,
      adminEmail,
      adminName,
    }),
  });

  const rawBody = await res.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    payload = {};
  }

  if (!res.ok) {
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof payload?.error === 'string'
          ? payload.error
          : rawBody?.slice(0, 300);
    console.error('[impersonation-api] upstream error', res.status, message);
    return null;
  }

  const data = payload?.data as Record<string, unknown> | undefined;
  const token = data?.token;
  if (typeof token !== 'string' || !token) {
    console.error('[impersonation-api] missing token in response');
    return null;
  }

  const impersonatedBy = (data?.impersonatedBy || {}) as {
    email?: string;
    name?: string;
  };
  const impersonatedUser = (data?.impersonatedUser || {}) as {
    id?: string;
    email?: string;
    name?: string;
  };
  const company = (data?.company || {}) as { id?: string; name?: string };

  return {
    token,
    sessionId: typeof data?.sessionId === 'string' ? data.sessionId : '',
    impersonatedBy: {
      email: impersonatedBy.email ?? adminEmail,
      name: impersonatedBy.name ?? adminName,
    },
    impersonatedUser: {
      id: impersonatedUser.id ?? userId,
      email: impersonatedUser.email ?? '',
      name: impersonatedUser.name ?? '',
    },
    company: {
      id: company.id ?? companyId,
      name: company.name ?? '',
    },
  };
}
