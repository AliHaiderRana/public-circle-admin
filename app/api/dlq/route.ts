import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/auth';
import { getBackendApiUrl, getBackendAuthHeaders } from '@/lib/backend-api.server';

export type DlqMessageDetail = {
  messageId: string;
  emailTo: string | null;
  emailFrom: string | null;
  emailSubject: string | null;
  companyId: string | null;
  companyName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  campaignRunId: string | null;
  campaignRunStartedAt: string | null;
  deliveryAttempts: number | null;
  index: number | null;
  queuedAt: string | null;
  failureReason: string | null;
  failureStatusCode: number | null;
  lastFailedAt: string | null;
};

export type DlqPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DlqStatus = {
  dlqMessageCount: number | null;
  dlqMessagesInFlight?: number;
  countError: string | null;
  messages: DlqMessageDetail[];
  messagesError: string | null;
  messagesLoadedCount?: number;
  dbFailureCount?: number;
  syncIncomplete?: boolean;
  /** @deprecated Use syncIncomplete */
  peekComplete?: boolean;
  pagination?: DlqPagination;
  stats?: { companies: number; runs: number };
  maxRetriesBeforeDlq: number;
  dlqLastAlertAt: string | null;
  dlqLastAlertedCount: number;
  environment: string | null;
};

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = request.nextUrl;
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '25';
    const search = searchParams.get('search') || '';

    const qs = new URLSearchParams({ page, pageSize });
    if (search) qs.set('search', search);

    const response = await fetch(`${await getBackendApiUrl()}/system/dlq?${qs}`, {
      headers: await getBackendAuthHeaders(),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || payload.error || 'Failed to fetch DLQ status');
    }

    const data = payload.data as DlqStatus;
    const safePage = Number(page) || 1;
    const safePageSize = Number(pageSize) || 25;
    const messages = data.messages || [];
    const rawPagination = data.pagination;
    const total = Number(rawPagination?.total ?? messages.length) || 0;
    const resolvedPageSize = Number(rawPagination?.pageSize ?? safePageSize) || safePageSize;
    const resolvedPage = Number(rawPagination?.page ?? safePage) || safePage;

    return NextResponse.json({
      ...data,
      messages,
      pagination: {
        page: resolvedPage,
        pageSize: resolvedPageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / resolvedPageSize) || 1),
      },
      stats: data.stats || { companies: 0, runs: 0 },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch DLQ status' },
      { status: 500 },
    );
  }
}
