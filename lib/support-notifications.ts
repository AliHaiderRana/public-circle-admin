type AdminNotificationLike = {
  type?: string;
  title?: string;
  description?: string;
};

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
