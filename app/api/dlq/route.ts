import { NextResponse } from 'next/server';
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

export type DlqStatus = {
  dlqMessageCount: number | null;
  dlqMessagesInFlight?: number;
  countError: string | null;
  messages: DlqMessageDetail[];
  messagesError: string | null;
  messagesLoadedCount?: number;
  peekComplete?: boolean;
  maxRetriesBeforeDlq: number;
  dlqLastAlertAt: string | null;
  dlqLastAlertedCount: number;
  environment: string | null;
};

export async function GET() {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const response = await fetch(`${getBackendApiUrl()}/system/dlq`, {
      headers: await getBackendAuthHeaders(),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || payload.error || 'Failed to fetch DLQ status');
    }

    const data = payload.data as DlqStatus;
    return NextResponse.json({
      ...data,
      messages: data.messages || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch DLQ status' },
      { status: 500 },
    );
  }
}
