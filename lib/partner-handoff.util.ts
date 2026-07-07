import {
  getEnabledListenEvents,
  type PartnerSocketEvent,
} from '@/lib/partner-socket-events.catalog';
import type { AdminPortalIntegration } from '@/lib/integration-settings.service';
import { PARTNER_SOCKET_EVENTS } from '@/lib/partner-realtime.constant';

export function isPartnerHandoffActive(adminPortal: AdminPortalIntegration): boolean {
  return Boolean(
    adminPortal.enabled &&
      adminPortal.referralEnabled &&
      adminPortal.adminPortalUrl?.trim() &&
      adminPortal.partnerPortalSsoSecret?.trim(),
  );
}

export function isPartnerStatsSocketListenEnabled(
  endpoints: PartnerSocketEvent[] | undefined,
): boolean {
  const listen = getEnabledListenEvents(endpoints ?? []);
  return (
    listen.includes(PARTNER_SOCKET_EVENTS.UNREAD_MESSAGES) ||
    listen.includes(PARTNER_SOCKET_EVENTS.OPEN_TICKETS)
  );
}

export function isPartnerStatsDeliveryEnabled(
  adminPortal: AdminPortalIntegration,
): boolean {
  return (
    isPartnerHandoffActive(adminPortal) &&
    isPartnerStatsSocketListenEnabled(adminPortal.adminIntegrationEndpoints)
  );
}
