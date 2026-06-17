const CHANNEL_NAME = 'circles-admin-support-sync';

export type AdminSupportChatMessage = {
  _id: string;
  senderType: string;
  senderName?: string;
  senderAdminId?: string;
  message: string;
  createdAt: string;
  visibility?: 'CUSTOMER' | 'INTERNAL';
  attachment?: {
    originalName?: string;
    contentType?: string;
    size?: number;
    s3Path?: string;
    viewUrl?: string;
  };
};

export type AdminSupportTicketStatusSyncPayload = {
  supportRequestId: string;
  status: string;
  pendingResolutionAt?: string | null;
  autoResolveAt?: string | null;
};

export type AdminSupportTabSyncEvent =
  | {
      type: 'CHAT_MESSAGE';
      supportRequestId: string;
      message: AdminSupportChatMessage;
      sourceTabId: string;
    }
  | {
      type: 'TICKET_STATUS';
      supportRequestId: string;
      status: string;
      pendingResolutionAt?: string | null;
      autoResolveAt?: string | null;
      sourceTabId: string;
    }
  | { type: 'INVALIDATE_REQUESTS'; sourceTabId: string }
  | { type: 'INVALIDATE_STATS'; sourceTabId: string }
  | {
      type: 'CHAT_PURGED';
      supportRequestId: string;
      purgedAt: string;
      sourceTabId: string;
    };

type ChatMessageListener = (payload: {
  supportRequestId: string;
  message: AdminSupportChatMessage;
}) => void;

type TicketStatusListener = (payload: AdminSupportTicketStatusSyncPayload) => void;

type ChatPurgedListener = (payload: {
  supportRequestId: string;
  purgedAt: string;
}) => void;

const tabId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}`;

let channel: BroadcastChannel | null = null;
const chatListeners = new Set<ChatMessageListener>();
const ticketStatusListeners = new Set<TicketStatusListener>();
const chatPurgedListeners = new Set<ChatPurgedListener>();

function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<AdminSupportTabSyncEvent>) => {
      const payload = event.data;
      if (!payload || payload.sourceTabId === tabId) return;

      if (payload.type === 'CHAT_MESSAGE') {
        chatListeners.forEach((listener) =>
          listener({
            supportRequestId: payload.supportRequestId,
            message: payload.message,
          }),
        );
        return;
      }

      if (payload.type === 'TICKET_STATUS') {
        const detail = {
          supportRequestId: payload.supportRequestId,
          status: payload.status,
          pendingResolutionAt: payload.pendingResolutionAt,
          autoResolveAt: payload.autoResolveAt,
        };
        ticketStatusListeners.forEach((listener) => listener(detail));
        window.dispatchEvent(new CustomEvent('admin-support:ticket-status', { detail }));
        return;
      }

      if (payload.type === 'CHAT_PURGED') {
        const detail = {
          supportRequestId: payload.supportRequestId,
          purgedAt: payload.purgedAt,
        };
        chatPurgedListeners.forEach((listener) => listener(detail));
        window.dispatchEvent(new CustomEvent('admin-support:chat-purged', { detail }));
        return;
      }

      if (payload.type === 'INVALIDATE_REQUESTS') {
        window.dispatchEvent(new CustomEvent('admin-support:invalidate-requests'));
        return;
      }

      if (payload.type === 'INVALIDATE_STATS') {
        window.dispatchEvent(new CustomEvent('admin-support:invalidate-stats'));
      }
    };
  }
  return channel;
}

export type AdminSupportTabSyncPayload =
  | { type: 'CHAT_MESSAGE'; supportRequestId: string; message: AdminSupportChatMessage }
  | {
      type: 'TICKET_STATUS';
      supportRequestId: string;
      status: string;
      pendingResolutionAt?: string | null;
      autoResolveAt?: string | null;
    }
  | { type: 'INVALIDATE_REQUESTS' }
  | { type: 'INVALIDATE_STATS' }
  | { type: 'CHAT_PURGED'; supportRequestId: string; purgedAt: string };

export function broadcastAdminSupportTabEvent(event: AdminSupportTabSyncPayload) {
  getChannel()?.postMessage({ ...event, sourceTabId: tabId } as AdminSupportTabSyncEvent);
}

export function onAdminSupportTabChatMessage(listener: ChatMessageListener) {
  chatListeners.add(listener);
  return () => {
    chatListeners.delete(listener);
  };
}

export function onAdminSupportTabTicketStatus(listener: TicketStatusListener) {
  ticketStatusListeners.add(listener);
  return () => {
    ticketStatusListeners.delete(listener);
  };
}

export function onAdminSupportTabChatPurged(listener: ChatPurgedListener) {
  chatPurgedListeners.add(listener);
  return () => {
    chatPurgedListeners.delete(listener);
  };
}

export function subscribeAdminSupportTabSync(
  handler: (event: AdminSupportTabSyncEvent) => void,
) {
  const activeChannel = getChannel();
  if (!activeChannel) return () => {};

  const listener = (event: MessageEvent<AdminSupportTabSyncEvent>) => {
    const payload = event.data;
    if (!payload || payload.sourceTabId === tabId) return;
    handler(payload);
  };

  activeChannel.addEventListener('message', listener);
  return () => {
    activeChannel.removeEventListener('message', listener);
  };
}
