import { getAdminPortalIntegration } from '@/lib/integration-settings.service';
import { resolveCustomerPortalSecret } from '@/lib/partner-handoff.util';

export async function isPartnerHandoffEnabled(): Promise<boolean> {
  const adminPortal = await getAdminPortalIntegration();
  return Boolean(
    adminPortal.enabled &&
      adminPortal.referralEnabled &&
      adminPortal.adminPortalUrl?.trim() &&
      resolveCustomerPortalSecret(adminPortal),
  );
}

export async function assertPartnerHandoffEnabled(): Promise<void> {
  const adminPortal = await getAdminPortalIntegration();

  if (!adminPortal.enabled && !adminPortal.referralEnabled) {
    throw new Error('Customer portal integration is disabled');
  }
  if (!adminPortal.enabled) {
    throw new Error('Customer portal integration is disabled on the admin portal');
  }
  if (!adminPortal.referralEnabled) {
    throw new Error('Customer portal integration is disabled on the referral app');
  }
  if (!adminPortal.adminPortalUrl?.trim() || !resolveCustomerPortalSecret(adminPortal)) {
    throw new Error('Customer portal integration is not configured');
  }
}
