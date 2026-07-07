import { getAdminPortalIntegration } from '@/lib/integration-settings.service';

export async function isPartnerHandoffEnabled(): Promise<boolean> {
  const adminPortal = await getAdminPortalIntegration();
  return Boolean(
    adminPortal.enabled &&
      adminPortal.referralEnabled &&
      adminPortal.adminPortalUrl?.trim() &&
      adminPortal.partnerPortalSsoSecret?.trim(),
  );
}

export async function assertPartnerHandoffEnabled(): Promise<void> {
  const adminPortal = await getAdminPortalIntegration();

  if (!adminPortal.enabled && !adminPortal.referralEnabled) {
    throw new Error('Partner portal handoff is disabled');
  }
  if (!adminPortal.enabled) {
    throw new Error('Partner portal handoff is disabled on the admin portal');
  }
  if (!adminPortal.referralEnabled) {
    throw new Error('Partner portal handoff is disabled on the Venndii Referral App');
  }
  if (!adminPortal.adminPortalUrl?.trim() || !adminPortal.partnerPortalSsoSecret?.trim()) {
    throw new Error('Partner portal handoff is not configured');
  }
}
