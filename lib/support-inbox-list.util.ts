import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import { getChatMessageInboxPreview } from '@/lib/support-chat.util';

export type SupportInboxTicketRow = {
  _id: string;
  status: string;
  updatedAt?: string;
  createdAt: string;
  unreadByAdmin?: number;
  lastMessagePreview?: string;
};

type ChatMessagePatch = {
  senderType: string;
  message: string;
  createdAt: string;
  attachment?: { viewUrl?: string; s3Path?: string } | null;
};

export function sortSupportInboxTickets<T extends SupportInboxTicketRow>(tickets: T[]): T[] {
  return [...tickets].sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime(),
  );
}

export function applyChatMessageToInboxTicket<T extends SupportInboxTicketRow>(
  ticket: T,
  message: ChatMessagePatch,
  options: { selectedTicketId: string | null; viewingTicketId?: string | null },
): T {
  const isUserMessage = message.senderType === 'USER';
  const isViewingTicket =
    options.viewingTicketId != null
      ? options.viewingTicketId === ticket._id
      : options.selectedTicketId === ticket._id;

  let unreadByAdmin = ticket.unreadByAdmin ?? 0;
  if (isUserMessage) {
    unreadByAdmin = isViewingTicket ? 0 : unreadByAdmin + 1;
  }

  let status = ticket.status;
  if (status === SUPPORT_REQUEST_STATUS.OPEN && message.senderType === 'ADMIN') {
    status = SUPPORT_REQUEST_STATUS.IN_PROGRESS;
  }

  return {
    ...ticket,
    status,
    updatedAt: message.createdAt,
    unreadByAdmin,
    lastMessagePreview: getChatMessageInboxPreview(message),
  };
}

export function patchSupportInboxTicketList<T extends SupportInboxTicketRow>(
  tickets: T[],
  ticketId: string,
  message: ChatMessagePatch,
  options: { selectedTicketId: string | null; viewingTicketId?: string | null },
): { tickets: T[]; found: boolean } {
  const index = tickets.findIndex((ticket) => ticket._id === ticketId);
  if (index === -1) {
    return { tickets, found: false };
  }

  const updated = applyChatMessageToInboxTicket(tickets[index], message, options);
  const next = [...tickets];
  next.splice(index, 1);
  next.unshift(updated);

  return { tickets: next, found: true };
}
