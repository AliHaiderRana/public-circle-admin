const CHANNEL_NAME = 'circles-admin-support-sync';

export type AdminSupportChatMessage = {
  _id: string;
  senderType: string;
  senderName: string;
  senderAdminId?: string;
  message: string;
  createdAt: string;
  visibility?: 'CUSTOMER' | 'INTERNAL';
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
  | { type: 'INVALIDATE_STATS'; sourceTabId: string };

type ChatMessageListener = (payload: {
  supportRequestId: string;
  message: AdminSupportChatMessage;
}) => void;

const tabId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}`;

let channel: BroadcastChannel | null = null;
const chatListeners = new Set<ChatMessageListener>();

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
        window.dispatchEvent(
          new CustomEvent('admin-support:ticket-status', { detail: payload }),
        );
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
  | { type: 'INVALIDATE_STATS' };

export function broadcastAdminSupportTabEvent(event: AdminSupportTabSyncPayload) {
  getChannel()?.postMessage({ ...event, sourceTabId: tabId } as AdminSupportTabSyncEvent);
}

export function onAdminSupportTabChatMessage(listener: ChatMessageListener) {
  chatListeners.add(listener);
  return () => {
    chatListeners.delete(listener);
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
