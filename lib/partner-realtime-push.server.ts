import dbConnect from '@/lib/db';
import SupportRequest from '@/lib/models/SupportRequest';
import {
  getReferralPartnerById,
  getReferralPartnersForCompany,
} from '@/lib/referral-partner.service';
import { schedulePartnerRealtimeStatsPush } from '@/lib/partner-realtime-socket.server';

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
