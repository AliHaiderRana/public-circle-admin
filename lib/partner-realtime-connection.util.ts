import {
  CUSTOMER_PORTAL_REALTIME_NAMESPACE,
  PARTNER_REALTIME_NAMESPACE,
} from '@/lib/partner-realtime.constant';

export const PARTNER_SOCKET_IO_PATH = '/socket.io';
export const PARTNER_SOCKET_AUTH_VALIDATOR =
  'auth.token = access JWT; auth.socketKey = shared secret key';
export const MAX_PARTNER_SOCKET_EVENTS = 4;
export const BUILTIN_PARTNER_SOCKET_EVENT_COUNT = MAX_PARTNER_SOCKET_EVENTS;

const LEGACY_NAMESPACES = ['/partner-realtime', '/customer-portal'];

function getOrigin(url?: string, fallback = ''): string {
  const raw = url?.trim();
  if (!raw) return fallback;
  try {
    return new URL(raw).origin.replace(/\/$/, '');
  } catch {
    return raw.replace(/\/$/, '');
  }
}

function stripRealtimeNamespace(pathname: string): string {
  let path = pathname.replace(/\/$/, '') || '';
  for (const ns of LEGACY_NAMESPACES) {
    if (path === ns || path.endsWith(ns)) {
      path = path.slice(0, path.length - ns.length) || '';
      break;
    }
  }
  return path;
}

/** Prefer Public Circle server — Socket.IO runs there, not on the admin redirect URL. */
export function getDefaultPartnerRealtimeConnectionUrl(
  _adminPortalUrl?: string,
  serverBaseUrl?: string,
): string {
  const serverOrigin =
    getOrigin(serverBaseUrl) ||
    getOrigin(process.env.NEXT_PUBLIC_SERVER_URL) ||
    getOrigin(process.env.SERVER_API_URL) ||
    'http://localhost:3001';
  return `${serverOrigin}${CUSTOMER_PORTAL_REALTIME_NAMESPACE}`;
}

export function parsePartnerRealtimeSocketSettings(
  configuredSocketUrl: string | undefined,
  adminPortalUrl?: string,
  serverBaseUrl?: string,
) {
  const connectionUrl = getDefaultPartnerRealtimeConnectionUrl(adminPortalUrl, serverBaseUrl);
  const raw = configuredSocketUrl?.trim() || connectionUrl;

  try {
    const url = new URL(raw);
    let pathname = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
    if (pathname === '/partner-realtime') {
      pathname = CUSTOMER_PORTAL_REALTIME_NAMESPACE;
    }
    const namespace =
      pathname && LEGACY_NAMESPACES.includes(pathname)
        ? CUSTOMER_PORTAL_REALTIME_NAMESPACE
        : pathname || CUSTOMER_PORTAL_REALTIME_NAMESPACE;
    const socketBaseUrl = url.origin.replace(/\/$/, '');
    return {
      socketUrl: `${socketBaseUrl}${namespace}`,
      socketBaseUrl,
      namespace,
      path: PARTNER_SOCKET_IO_PATH,
      connectionUrl: `${socketBaseUrl}${namespace}`,
    };
  } catch {
    const socketBaseUrl = stripRealtimeNamespace(raw).replace(/\/$/, '');
    return {
      socketUrl: `${socketBaseUrl}${CUSTOMER_PORTAL_REALTIME_NAMESPACE}`,
      socketBaseUrl,
      namespace: CUSTOMER_PORTAL_REALTIME_NAMESPACE,
      path: PARTNER_SOCKET_IO_PATH,
      connectionUrl: `${socketBaseUrl}${CUSTOMER_PORTAL_REALTIME_NAMESPACE}`,
    };
  }
}

export function resolvePartnerRealtimeSocketUrl(
  configuredSocketUrl: string | undefined,
  adminPortalUrl: string | undefined,
  serverBaseUrl?: string,
): string {
  return parsePartnerRealtimeSocketSettings(
    configuredSocketUrl,
    adminPortalUrl,
    serverBaseUrl,
  ).socketBaseUrl;
}

export function buildPartnerRealtimeConnectionInfo(input: {
  adminPortalUrl?: string;
  partnerRealtimeSocketUrl?: string;
  partnerSocketAuthValidator?: string;
  serverBaseUrl?: string;
}) {
  const parsed = parsePartnerRealtimeSocketSettings(
    input.partnerRealtimeSocketUrl,
    input.adminPortalUrl,
    input.serverBaseUrl,
  );

  return {
    ...parsed,
    authValidator:
      input.partnerSocketAuthValidator?.trim() || PARTNER_SOCKET_AUTH_VALIDATOR,
  };
}

export { PARTNER_REALTIME_NAMESPACE, CUSTOMER_PORTAL_REALTIME_NAMESPACE };
