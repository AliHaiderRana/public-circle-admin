import type { AdminPortalIntegration } from '@/lib/integration-settings.service';

/** Shared secret for handoff JWT + realtime socket auth. */
export function resolveCustomerPortalSecret(
  adminPortal: Pick<
    AdminPortalIntegration,
    'partnerPortalSsoSecret' | 'partnerRealtimeSocketKey'
  >,
): string {
  return (
    adminPortal.partnerPortalSsoSecret?.trim() ||
    adminPortal.partnerRealtimeSocketKey?.trim() ||
    ''
  );
}

export function isPartnerHandoffActive(adminPortal: AdminPortalIntegration): boolean {
  return Boolean(
    adminPortal.enabled &&
      adminPortal.referralEnabled &&
      adminPortal.adminPortalUrl?.trim() &&
      resolveCustomerPortalSecret(adminPortal),
  );
}

/** Live badges + Support Panel require the customer portal toggle + shared secret. */
export function isPartnerStatsDeliveryEnabled(
  adminPortal: AdminPortalIntegration,
): boolean {
  return isPartnerHandoffActive(adminPortal);
}
