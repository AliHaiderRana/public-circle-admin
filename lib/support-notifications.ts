import { ADMIN_NOTIFICATION_TYPES } from '@/lib/constants';

type AdminNotificationLike = {
  type?: string;
  title?: string;
  description?: string;
  metadata?: {
    supportRequestId?: string;
    customerRequestId?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

const SUPPORT_THREAD_NOTIFICATION_TYPES = new Set([
  ADMIN_NOTIFICATION_TYPES.SUPPORT_REQUEST_CREATED,
  ADMIN_NOTIFICATION_TYPES.SUPPORT_CHAT_CUSTOMER_MESSAGE,
]);

export function isSupportThreadNotification(type?: string) {
  return Boolean(type && SUPPORT_THREAD_NOTIFICATION_TYPES.has(type));
}

function normalizeThreadId(value: unknown): string {
  return String(value ?? '').trim();
}

export function dedupeNotificationsForDisplay<T extends AdminNotificationLike>(
  notifications: T[],
  maxItems = 5,
): T[] {
  const seenSupportThreads = new Set<string>();
  const deduped: T[] = [];

  for (const notification of notifications) {
    const supportRequestId = normalizeThreadId(notification.metadata?.supportRequestId);
    if (isSupportThreadNotification(notification.type) && supportRequestId) {
      if (seenSupportThreads.has(supportRequestId)) continue;
      seenSupportThreads.add(supportRequestId);
    }

    deduped.push(notification);
    if (deduped.length >= maxItems) break;
  }

  return deduped;
}

export function mergeIncomingAdminNotification<T extends AdminNotificationLike & { _id?: string }>(
  existing: T[],
  incoming: T,
  maxItems = 5,
): T[] {
  const withoutSameId = existing.filter((item) => item._id !== incoming._id);
  return [incoming, ...withoutSameId].slice(0, maxItems);
}

const ADMIN_LEGACY_TITLES: Record<string, string> = {
  'New Support Request': 'New support ticket',
  'New support chat message': 'New message in Support',
};

export function getAdminNotificationDisplay(notification: AdminNotificationLike): {
  title: string;
  description: string;
} {
  const description = notification.description || '';

  switch (notification.type) {
    case 'SUPPORT_REQUEST_CREATED':
      return {
        title: 'New support ticket',
        description,
      };
    case 'SUPPORT_CHAT_CUSTOMER_MESSAGE':
      return {
        title: 'New message on support ticket',
        description,
      };
    default:
      return {
        title:
          (notification.title && ADMIN_LEGACY_TITLES[notification.title]) ||
          notification.title ||
          'Notification',
        description,
      };
  }
}
