import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import {
  getReferralPartnerById,
  getReferralPartnersForCompany,
} from '@/lib/referral-partner.service';
import { getIntegrationSettings } from '@/lib/integration-settings.service';
import { resolveCustomerPortalSecret } from '@/lib/partner-handoff.util';

const DEBOUNCE_MS = 400;
const pendingPartnerIds = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function resolveServerPushBaseUrl(serverBaseUrl?: string): string {
  const raw =
    serverBaseUrl?.trim() ||
    process.env.SERVER_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_SERVER_URL?.trim() ||
    '';
  return raw.replace(/\/$/, '');
}

async function pushPartnerRealtimeStats(referralUserIds: string[]): Promise<void> {
  if (!referralUserIds.length) return;

  const settings = await getIntegrationSettings();
  const adminPortal = settings.adminPortal;
  const secretKey = resolveCustomerPortalSecret(adminPortal);
  const serverBaseUrl = resolveServerPushBaseUrl(settings.publicCircleServer.serverBaseUrl);
  const internalApiKey = settings.publicCircleServer.internalApiKey?.trim();

  if (!serverBaseUrl || !secretKey) {
    return;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-partner-realtime-secret': secretKey,
    };
    if (internalApiKey) {
      headers['x-internal-api-key'] = internalApiKey;
    }

    const response = await fetch(`${serverBaseUrl}/internal/customer-portal/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ referralUserIds }),
    });

    if (!response.ok && process.env.NODE_ENV === 'development') {
      const body = await response.text();
      console.warn('[customer-portal] remote push failed:', response.status, body);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[customer-portal] remote push failed:', error);
    }
  }
}

export function schedulePartnerRealtimeStatsPush(referralUserId: string): void {
  const id = String(referralUserId || '').trim();
  if (!id) return;

  pendingPartnerIds.add(id);

  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    const ids = Array.from(pendingPartnerIds);
    pendingPartnerIds.clear();
    flushTimer = null;
    void pushPartnerRealtimeStats(ids);
  }, DEBOUNCE_MS);
}

export async function schedulePartnerRealtimeStatsForTicket(input: {
  supportRequestId?: string;
  companyId?: string | null;
  assignedAdminId?: string | null;
  previousAssignedAdminId?: string | null;
}): Promise<void> {
  const partnerIds = new Set<string>();

  if (input.assignedAdminId) {
    const partner = await getReferralPartnerById(String(input.assignedAdminId));
    if (partner?._id) {
      partnerIds.add(String(partner._id));
    }
  }

  if (input.previousAssignedAdminId) {
    const partner = await getReferralPartnerById(String(input.previousAssignedAdminId));
    if (partner?._id) {
      partnerIds.add(String(partner._id));
    }
  }

  let companyId = input.companyId;
  let assignedAdminId = input.assignedAdminId;

  if (input.supportRequestId && (companyId == null || assignedAdminId === undefined)) {
    await dbConnect();
    const ticket = await SupportRequest.findById(input.supportRequestId)
      .select('companyId assignedAdminId')
      .lean();
    if (companyId == null) {
      companyId = ticket?.companyId ? String(ticket.companyId) : null;
    }
    if (assignedAdminId === undefined) {
      assignedAdminId = ticket?.assignedAdminId ? String(ticket.assignedAdminId) : null;
    }
  }

  if (companyId) {
    const partners = await getReferralPartnersForCompany(String(companyId));
    for (const partner of partners) {
      if (partner.id) {
        partnerIds.add(String(partner.id));
      }
    }
  }

  if (assignedAdminId) {
    const partner = await getReferralPartnerById(String(assignedAdminId));
    if (partner?._id) {
      partnerIds.add(String(partner._id));
    }
  }

  for (const partnerId of partnerIds) {
    schedulePartnerRealtimeStatsPush(partnerId);
  }
}

export async function schedulePartnerRealtimeStatsForCompany(
  companyId: string,
): Promise<void> {
  const partners = await getReferralPartnersForCompany(companyId);
  for (const partner of partners) {
    if (partner.id) {
      schedulePartnerRealtimeStatsPush(partner.id);
    }
  }
}
