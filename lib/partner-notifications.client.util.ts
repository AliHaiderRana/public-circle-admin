/** Client-safe helpers for partner notification scoping (no mongoose / DB imports). */

export function partnerCanAccessNotificationCompany(
  companyIds: string[],
  companyId: unknown,
): boolean {
  if (!companyId) return false;
  const normalized =
    typeof companyId === 'object' && companyId !== null && '_id' in companyId
      ? String((companyId as { _id: unknown })._id)
      : String(companyId);
  return companyIds.includes(normalized);
}

type PartnerNotificationMetadata = {
  supportRequestId?: unknown;
  assignedAdminId?: unknown;
  assigneeType?: unknown;
};

export function partnerCanAccessNotification(
  partnerReferralUserId: string | undefined,
  metadata?: PartnerNotificationMetadata,
): boolean {
  if (!partnerReferralUserId) return false;
  const assignedAdminId = metadata?.assignedAdminId;
  return Boolean(assignedAdminId && String(assignedAdminId) === partnerReferralUserId);
}
