let activeSupportTicketId: string | null = null;

const SUPPORT_INBOX_PATH = '/dashboard/support-requests';

export function setActiveAdminSupportTicketId(ticketId: string | null) {
  activeSupportTicketId = ticketId ? String(ticketId) : null;
}

export function getActiveAdminSupportTicketId(): string | null {
  return activeSupportTicketId;
}

export function isViewingAdminSupportTicket(ticketId: string | null | undefined): boolean {
  if (!ticketId || !activeSupportTicketId) return false;
  return String(ticketId) === activeSupportTicketId;
}

export function isAdminOnSupportInboxPage(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path === SUPPORT_INBOX_PATH || path.startsWith(`${SUPPORT_INBOX_PATH}/`);
}

/**
 * True when the admin is viewing this ticket's chat on the support inbox with the tab visible.
 * TicketChatPanel being mounted is the primary signal; activeSupportTicketId is a secondary check.
 */
export function canMarkAdminSupportTicketRead(ticketId: string | null | undefined): boolean {
  if (!ticketId) return false;
  if (typeof window === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  if (!isAdminOnSupportInboxPage()) return false;
  const activeId = getActiveAdminSupportTicketId();
  if (!activeId) return true;
  return isViewingAdminSupportTicket(ticketId);
}
