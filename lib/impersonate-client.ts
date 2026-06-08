export async function startImpersonation({
  userId,
  companyId,
  adminToken,
}: {
  userId: string;
  companyId: string;
  adminToken?: string | null;
}): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }

  const response = await fetch('/api/impersonate', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ userId, companyId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Failed to start impersonation'
    );
  }
  if (typeof data.redirectUrl !== 'string' || !data.redirectUrl) {
    throw new Error('Invalid redirect URL from server');
  }
  return data.redirectUrl;
}
