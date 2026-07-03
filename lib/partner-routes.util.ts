export const PARTNER_HOME_PATH = '/dashboard/support-requests';

export const PARTNER_ALLOWED_PATH_PREFIXES = [
  '/dashboard/companies',
  '/dashboard/users',
  '/dashboard/campaigns',
  '/dashboard/campaign-runs',
  '/dashboard/support-requests',
  '/dashboard/support-chat',
  '/dashboard/profile',
];

export const PARTNER_FORBIDDEN_PATH_PREFIXES = [
  '/dashboard/stripe',
  '/dashboard/plans',
] as const;

export function isPartnerForbiddenPath(pathname: string): boolean {
  return PARTNER_FORBIDDEN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isPartnerAllowedPath(pathname: string): boolean {
  if (isPartnerForbiddenPath(pathname)) return false;
  if (pathname === '/dashboard') return true;
  return PARTNER_ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
