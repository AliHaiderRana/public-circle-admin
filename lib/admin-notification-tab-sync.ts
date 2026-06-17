import type { AdminNotificationPayload } from '@/lib/admin-notification-socket';

const CHANNEL_NAME = 'circles-admin-notification-sync';

export type AdminNotificationTabSyncEvent =
  | {
      type: 'NOTIFICATION_CREATED';
      notification: AdminNotificationPayload;
      sourceTabId: string;
    }
  | { type: 'REFRESH'; sourceTabId: string };

const tabId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Date.now()}`;

let channel: BroadcastChannel | null = null;
const notificationListeners = new Set<(notification: AdminNotificationPayload) => void>();
const refreshListeners = new Set<() => void>();

function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<AdminNotificationTabSyncEvent>) => {
      const payload = event.data;
      if (!payload || payload.sourceTabId === tabId) return;

      if (payload.type === 'NOTIFICATION_CREATED') {
        notificationListeners.forEach((listener) => listener(payload.notification));
        return;
      }

      if (payload.type === 'REFRESH') {
        refreshListeners.forEach((listener) => listener());
        window.dispatchEvent(new Event('admin-notifications:refresh'));
      }
    };
  }
  return channel;
}

export function broadcastAdminNotificationTabEvent(
  event:
    | { type: 'NOTIFICATION_CREATED'; notification: AdminNotificationPayload }
    | { type: 'REFRESH' },
) {
  getChannel()?.postMessage({ ...event, sourceTabId: tabId } as AdminNotificationTabSyncEvent);
}

export function onAdminNotificationTabCreated(
  listener: (notification: AdminNotificationPayload) => void,
) {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

export function onAdminNotificationTabRefresh(listener: () => void) {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
}
