export type PartnerSocketEventKind = 'socket-listen' | 'socket-emit';

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

function isLegacySocketConfig(stored: Partial<PartnerSocketEvent>[]): boolean {
  const legacyIds = [
    'handoff-partner',
    'socket-stats-updated',
    'socket-stats-refresh',
    'partner-stats-internal',
  ];
  const legacyPaths = ['partner-support-stats-updated', 'partner-stats:refresh', '/auth/partner'];

  return stored.some(
    (entry) =>
      (entry as { kind?: string }).kind === 'http' ||
      legacyIds.includes(String(entry.id)) ||
      legacyPaths.some((marker) => String(entry.path || '').includes(marker)),
  );
}

export function mergePartnerSocketEvents(
  stored?: Partial<PartnerSocketEvent>[] | null,
): PartnerSocketEvent[] {
  if (!stored?.length || isLegacySocketConfig(stored)) {
    return DEFAULT_PARTNER_SOCKET_EVENTS.map((event) => ({ ...event }));
  }

  const merged = stored
    .filter((item) => item.kind === 'socket-listen' || item.kind === 'socket-emit')
    .map((item) => {
      const defaultEntry = DEFAULT_PARTNER_SOCKET_EVENTS.find((event) => event.id === item.id);
      if (defaultEntry) {
        return {
          ...defaultEntry,
          enabled: item.enabled ?? defaultEntry.enabled,
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

  return merged;
}

export function getEnabledListenEvents(events: PartnerSocketEvent[]): string[] {
  return events.filter((e) => e.enabled && e.kind === 'socket-listen').map((e) => e.path);
}

export function getEnabledEmitEvents(events: PartnerSocketEvent[]): string[] {
  return events.filter((e) => e.enabled && e.kind === 'socket-emit').map((e) => e.path);
}
