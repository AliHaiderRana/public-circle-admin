export const CUSTOMER_PORTAL_REALTIME_NAMESPACE = '/customer-portal';
/** @deprecated Prefer CUSTOMER_PORTAL_REALTIME_NAMESPACE */
export const PARTNER_REALTIME_NAMESPACE = CUSTOMER_PORTAL_REALTIME_NAMESPACE;

export const PARTNER_SOCKET_EVENTS = {
  UNREAD_MESSAGES: 'partner.unread-messages',
  UNREAD_MESSAGES_REFRESH: 'partner.unread-messages.refresh',
  OPEN_TICKETS: 'partner.open-tickets',
  OPEN_TICKETS_REFRESH: 'partner.open-tickets.refresh',
} as const;
