export type PartnerSocketEventKind = 'socket-listen' | 'socket-emit';
export type HttpIntegrationEndpointKind = 'http';
export type AdminIntegrationEndpointKind = PartnerSocketEventKind | HttpIntegrationEndpointKind;

export type PartnerSocketEvent = {
  id: string;
  kind: PartnerSocketEventKind;
  method: 'SOCKET';
  path: string;
  enabled: boolean;
  label: string;
  auth: string;
  builtin?: boolean;
  pairedEventId?: string;
  requestBodySample?: string;
  responseSample?: string;
};

export type HttpIntegrationEndpoint = {
  id: string;
  kind: HttpIntegrationEndpointKind;
  method: string;
  path: string;
  enabled: boolean;
  label: string;
  auth: string;
  builtin?: boolean;
  requestBodySample?: string;
  responseSample?: string;
};

export type AdminIntegrationEndpoint = PartnerSocketEvent | HttpIntegrationEndpoint;

export const THIRD_PARTY_USER_PROVISION_PATH =
  '/api/internal/referral/third-party-users/provision';

export const PROVISION_WEBHOOK_ID = 'provision-internal';
export const MAX_HTTP_INTEGRATION_ENDPOINTS = 1;

const HTTP_AUTH = 'X-Referral-Backend-Api-Key';

export const PARTNER_SOCKET_EVENT_NAMES = {
  UNREAD_MESSAGES: 'partner.unread-messages',
  UNREAD_MESSAGES_REFRESH: 'partner.unread-messages.refresh',
  OPEN_TICKETS: 'partner.open-tickets',
  OPEN_TICKETS_REFRESH: 'partner.open-tickets.refresh',
} as const;

const SOCKET_AUTH = 'Socket auth.token = partner access token (JWT)';

export const DEFAULT_PARTNER_SOCKET_EVENTS: PartnerSocketEvent[] = [
  {
    id: 'socket-unread-messages',
    kind: 'socket-listen',
    method: 'SOCKET',
    path: PARTNER_SOCKET_EVENT_NAMES.UNREAD_MESSAGES,
    enabled: true,
    label: 'Unread chat messages (server → client)',
    auth: SOCKET_AUTH,
    builtin: true,
    pairedEventId: 'socket-unread-messages-refresh',
    responseSample: JSON.stringify({ count: 3 }, null, 2),
  },
  {
    id: 'socket-unread-messages-refresh',
    kind: 'socket-emit',
    method: 'SOCKET',
    path: PARTNER_SOCKET_EVENT_NAMES.UNREAD_MESSAGES_REFRESH,
    enabled: true,
    label: 'Refresh unread messages (client → server)',
    auth: SOCKET_AUTH,
    builtin: true,
    pairedEventId: 'socket-unread-messages',
    requestBodySample: JSON.stringify({}, null, 2),
  },
  {
    id: 'socket-open-tickets',
    kind: 'socket-listen',
    method: 'SOCKET',
    path: PARTNER_SOCKET_EVENT_NAMES.OPEN_TICKETS,
    enabled: true,
    label: 'Open support tickets (server → client)',
    auth: SOCKET_AUTH,
    builtin: true,
    pairedEventId: 'socket-open-tickets-refresh',
    responseSample: JSON.stringify({ count: 5 }, null, 2),
  },
  {
    id: 'socket-open-tickets-refresh',
    kind: 'socket-emit',
    method: 'SOCKET',
    path: PARTNER_SOCKET_EVENT_NAMES.OPEN_TICKETS_REFRESH,
    enabled: true,
    label: 'Refresh open tickets (client → server)',
    auth: SOCKET_AUTH,
    builtin: true,
    pairedEventId: 'socket-open-tickets',
    requestBodySample: JSON.stringify({}, null, 2),
  },
];

export const DEFAULT_HTTP_INTEGRATION_ENDPOINTS: HttpIntegrationEndpoint[] = [
  {
    id: PROVISION_WEBHOOK_ID,
    kind: 'http',
    method: 'POST',
    path: THIRD_PARTY_USER_PROVISION_PATH,
    enabled: true,
    label: 'Provision referral user on signup',
    auth: HTTP_AUTH,
    builtin: true,
    requestBodySample: JSON.stringify({ referralUserId: '64f1c2...' }, null, 2),
    responseSample: JSON.stringify({ message: 'Third-party user provisioned' }, null, 2),
  },
];

function isLegacySocketConfig(stored: Partial<AdminIntegrationEndpoint>[]): boolean {
  const legacyIds = [
    'handoff-partner',
    'socket-stats-updated',
    'socket-stats-refresh',
    'partner-stats-internal',
  ];
  const legacyPaths = ['partner-support-stats-updated', 'partner-stats:refresh', '/auth/partner'];

  return stored.some(
    (entry) =>
      legacyIds.includes(String(entry.id)) ||
      legacyPaths.some((marker) => String(entry.path || '').includes(marker)),
  );
}

function mergeSocketEndpoints(stored: Partial<AdminIntegrationEndpoint>[]): PartnerSocketEvent[] {
  if (!stored.length || isLegacySocketConfig(stored)) {
    return DEFAULT_PARTNER_SOCKET_EVENTS.map((event) => ({ ...event }));
  }

  const socketOnly = stored.filter(
    (item) => item.kind === 'socket-listen' || item.kind === 'socket-emit',
  );

  const merged = socketOnly.map((item) => {
    const defaultEntry = DEFAULT_PARTNER_SOCKET_EVENTS.find((event) => event.id === item.id);
    if (defaultEntry) {
      return {
        ...defaultEntry,
        enabled: item.enabled ?? defaultEntry.enabled,
        path: item.path?.trim() || defaultEntry.path,
        requestBodySample: item.requestBodySample ?? defaultEntry.requestBodySample,
        responseSample: item.responseSample ?? defaultEntry.responseSample,
        label: item.label?.trim() || defaultEntry.label,
        pairedEventId: item.pairedEventId ?? defaultEntry.pairedEventId,
      };
    }

    return {
      id: item.id || `custom-${Date.now()}`,
      kind: item.kind === 'socket-emit' ? 'socket-emit' : 'socket-listen',
      method: 'SOCKET',
      path: item.path?.trim() || 'partner.custom-event',
      enabled: item.enabled ?? true,
      label: item.label?.trim() || item.path || 'Custom socket event',
      auth: item.auth?.trim() || SOCKET_AUTH,
      builtin: false,
      pairedEventId: item.pairedEventId,
      requestBodySample: item.requestBodySample,
      responseSample: item.responseSample,
    };
  });

  return merged.length ? merged : DEFAULT_PARTNER_SOCKET_EVENTS.map((event) => ({ ...event }));
}

function mergeHttpEndpoints(stored: Partial<AdminIntegrationEndpoint>[]): HttpIntegrationEndpoint[] {
  const httpOnly = stored
    .filter((entry) => entry.kind === 'http')
    .slice(0, MAX_HTTP_INTEGRATION_ENDPOINTS);
  const configured =
    httpOnly.find((entry) => entry.id === PROVISION_WEBHOOK_ID) ?? httpOnly[0] ?? null;

  return DEFAULT_HTTP_INTEGRATION_ENDPOINTS.map((base) => {
    const item = configured?.id === base.id ? configured : null;
    if (!item) {
      return { ...base };
    }

    return {
      ...base,
      enabled: item.enabled ?? base.enabled,
      path: item.path?.trim() || base.path,
      label: item.label?.trim() || base.label,
      requestBodySample: item.requestBodySample ?? base.requestBodySample,
      responseSample: item.responseSample ?? base.responseSample,
    };
  });
}

export function mergeAdminIntegrationEndpoints(
  stored?: Partial<AdminIntegrationEndpoint>[] | null,
  existing?: Partial<AdminIntegrationEndpoint>[] | null,
): AdminIntegrationEndpoint[] {
  const storedList = stored ?? [];
  const existingList = existing ?? [];

  const socketSource = storedList.some(
    (entry) => entry.kind === 'socket-listen' || entry.kind === 'socket-emit',
  )
    ? storedList
    : existingList;

  const httpSource = storedList.some((entry) => entry.kind === 'http') ? storedList : existingList;

  return [...mergeSocketEndpoints(socketSource), ...mergeHttpEndpoints(httpSource)];
}

/** @deprecated Use mergeAdminIntegrationEndpoints — kept for socket-only callers. */
export function mergePartnerSocketEvents(
  stored?: Partial<PartnerSocketEvent>[] | null,
): PartnerSocketEvent[] {
  return mergeSocketEndpoints(stored ?? []);
}

export function getEnabledListenEvents(events: PartnerSocketEvent[]): string[] {
  return events.filter((e) => e.enabled && e.kind === 'socket-listen').map((e) => e.path);
}

export function getEnabledEmitEvents(events: PartnerSocketEvent[]): string[] {
  return events.filter((e) => e.enabled && e.kind === 'socket-emit').map((e) => e.path);
}
