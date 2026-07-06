import { PARTNER_REALTIME_NAMESPACE } from '@/lib/partner-realtime.constant';

export const PARTNER_SOCKET_IO_PATH = '/socket.io';
export const PARTNER_SOCKET_AUTH_VALIDATOR =
  'auth.token = partner JWT; auth.socketKey = partner realtime socket key (admin-generated)';
export const MAX_PARTNER_SOCKET_EVENTS = 4;
export const BUILTIN_PARTNER_SOCKET_EVENT_COUNT = MAX_PARTNER_SOCKET_EVENTS;

function getAdminPortalOrigin(adminPortalUrl?: string): string {
  const admin = adminPortalUrl?.trim();
  if (admin) {
    try {
      return new URL(admin).origin.replace(/\/$/, '');
    } catch {
      return admin.replace(/\/$/, '');
    }
  }
  return 'http://localhost:3000';
}

export function getDefaultPartnerRealtimeConnectionUrl(adminPortalUrl?: string): string {
  return `${getAdminPortalOrigin(adminPortalUrl)}${PARTNER_REALTIME_NAMESPACE}`;
}

export function parsePartnerRealtimeSocketSettings(
  configuredSocketUrl: string | undefined,
  adminPortalUrl?: string,
) {
  const connectionUrl = getDefaultPartnerRealtimeConnectionUrl(adminPortalUrl);
  const raw = configuredSocketUrl?.trim() || connectionUrl;

  try {
    const url = new URL(raw);
    const namespace =
      url.pathname && url.pathname !== '/'
        ? url.pathname.replace(/\/$/, '')
        : PARTNER_REALTIME_NAMESPACE;
    const socketBaseUrl = url.origin.replace(/\/$/, '');
    return {
      socketUrl: `${socketBaseUrl}${namespace}`,
      socketBaseUrl,
      namespace,
      path: PARTNER_SOCKET_IO_PATH,
      connectionUrl: `${socketBaseUrl}${namespace}`,
    };
  } catch {
    const socketBaseUrl = raw.replace(/\/partner-realtime\/?$/, '').replace(/\/$/, '');
    return {
      socketUrl: `${socketBaseUrl}${PARTNER_REALTIME_NAMESPACE}`,
      socketBaseUrl,
      namespace: PARTNER_REALTIME_NAMESPACE,
      path: PARTNER_SOCKET_IO_PATH,
      connectionUrl: `${socketBaseUrl}${PARTNER_REALTIME_NAMESPACE}`,
    };
  }
}

export function resolvePartnerRealtimeSocketUrl(
  configuredSocketUrl: string | undefined,
  adminPortalUrl: string | undefined,
): string {
  return parsePartnerRealtimeSocketSettings(configuredSocketUrl, adminPortalUrl).socketBaseUrl;
}

export function buildPartnerRealtimeConnectionInfo(input: {
  adminPortalUrl?: string;
  partnerRealtimeSocketUrl?: string;
  partnerSocketAuthValidator?: string;
}) {
  const parsed = parsePartnerRealtimeSocketSettings(
    input.partnerRealtimeSocketUrl,
    input.adminPortalUrl,
  );

  return {
    ...parsed,
    authValidator:
      input.partnerSocketAuthValidator?.trim() || PARTNER_SOCKET_AUTH_VALIDATOR,
  };
}
