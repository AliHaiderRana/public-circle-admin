export const REFERRAL_PORTAL_ROLES = [
  'ADMIN',
  'SALES_PERSON',
  'MARKETING_AFFILIATE',
] as const;

export type ReferralPortalRole = (typeof REFERRAL_PORTAL_ROLES)[number];

export function isReferralPortalRole(role?: string): role is ReferralPortalRole {
  if (!role) return false;
  return (REFERRAL_PORTAL_ROLES as readonly string[]).includes(role);
}
