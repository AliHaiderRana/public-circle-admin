import { NextResponse } from 'next/server';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  isPartnerSession,
  getPartnerAllowedCompanyIds,
} from '@/lib/partner-access.util';
import { internalApiFetch } from '@/lib/internal-api.server';
import { logPartnerPortalActivity, PARTNER_PORTAL_ACTIONS } from '@/lib/partner-activity';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';
  const search = searchParams.get('search') || '';

  try {
    const response = await internalApiFetch(
      `/support-chat/threads?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
    );
    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.errorMessage || 'Failed to fetch chat threads' },
        { status: response.status },
      );
    }

    let data = payload.data;

    if (isPartnerSession(session) && data?.threads) {
      const allowedIds = new Set(await getPartnerAllowedCompanyIds(session));
      data = {
        ...data,
        threads: data.threads.filter((thread: { companyId?: string }) =>
          thread.companyId ? allowedIds.has(String(thread.companyId)) : false,
        ),
      };
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logPartnerPortalActivity(auditSession, {
        action: PARTNER_PORTAL_ACTIONS.VIEW_SUPPORT_CHAT_THREADS,
        resourceType: 'support_chat_thread',
        details: {
          page: Number(page),
          limit: Number(limit),
          search: search || undefined,
          threadCount: Array.isArray(data?.threads) ? data.threads.length : undefined,
        },
        summary: 'Partner viewed support chat threads',
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chat threads' }, { status: 500 });
  }
}
