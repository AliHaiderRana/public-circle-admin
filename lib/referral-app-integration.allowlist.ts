/**
 * Admin routes the Venndii Referral App is allowed to use.
 * Must stay in sync with referral-app/BE referral-integration.allowlist.ts
 */

export type ReferralIntegrationRoute = {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  pathPattern: RegExp;
};

/** Browser handoff — referral app opens this route on the admin portal. */
export const REFERRAL_APP_ALLOWED_ADMIN_ROUTES: ReferralIntegrationRoute[] = [
  {
    id: 'handoff-complete',
    method: 'GET',
    pathPattern: /^\/auth\/partner$/,
  },
];

/**
 * Server-to-server routes callable with X-Referral-Backend-Api-Key.
 * Must match enabled HTTP rows on referral Integrations.
 */
export const REFERRAL_BACKEND_ALLOWED_INTERNAL_ROUTES: ReferralIntegrationRoute[] = [
  {
    id: 'partner-stats-internal',
    method: 'GET',
    pathPattern: /^\/api\/internal\/referral\/partner-support-stats\/[^/]+$/,
  },
  {
    id: 'provision-internal',
    method: 'POST',
    pathPattern: /^\/api\/internal\/referral\/third-party-users\/provision$/,
  },
];

function normalizePath(pathname: string): string {
  if (!pathname.startsWith('/')) {
    return `/${pathname}`;
  }
  return pathname.replace(/\/$/, '') || '/';
}

export function isReferralBackendAllowedInternalRoute(
  method: string,
  pathname: string,
): boolean {
  const normalized = normalizePath(pathname);
  const verb = method.toUpperCase();

  return REFERRAL_BACKEND_ALLOWED_INTERNAL_ROUTES.some((route) => {
    if (route.method !== verb) {
      return false;
    }

    const patternSource = route.pathPattern.source.replace(/^\^/, '').replace(/\$$/, '');
    const flexiblePattern = new RegExp(`^${patternSource}/?$`);
    return flexiblePattern.test(normalized);
  });
}

export function isReferralAppAllowedAdminBrowserRoute(
  method: string,
  pathname: string,
): boolean {
  const normalized = normalizePath(pathname);
  const verb = method.toUpperCase();

  return REFERRAL_APP_ALLOWED_ADMIN_ROUTES.some(
    (route) => route.method === verb && route.pathPattern.test(normalized),
  );
}
