export const PARTNER_REALTIME_NAMESPACE = '/partner-realtime';

export const PARTNER_SOCKET_EVENTS = {
  UNREAD_MESSAGES: 'partner.unread-messages',
  UNREAD_MESSAGES_REFRESH: 'partner.unread-messages.refresh',
  OPEN_TICKETS: 'partner.open-tickets',
  OPEN_TICKETS_REFRESH: 'partner.open-tickets.refresh',
} as const;
