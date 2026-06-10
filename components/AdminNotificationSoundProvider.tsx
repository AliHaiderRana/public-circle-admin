'use client';

import { useEffect, type ReactNode } from 'react';
import { unlockAdminNotificationSound, playAdminNotificationSound } from '@/lib/notification-sound';
import {
  ensureAdminNotificationSocket,
  subscribeAdminNotifications,
  subscribeAdminSupportChatMessages,
} from '@/lib/admin-notification-socket';
import { SUPPORT_CHAT_SENDER_TYPE } from '@/lib/constants';
import { isViewingAdminSupportTicket } from '@/lib/admin-support-view';

type AdminNotificationSoundProviderProps = {
  children: ReactNode;
};

export function AdminNotificationSoundProvider({
  children,
}: AdminNotificationSoundProviderProps) {
  useEffect(() => {
    const unlock = () => {
      unlockAdminNotificationSound();
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    void ensureAdminNotificationSocket();

    const refreshNotifications = () => {
      window.dispatchEvent(new Event('admin-notifications:refresh'));
    };

    const unsubscribeNotifications = subscribeAdminNotifications(() => {
      playAdminNotificationSound();
      refreshNotifications();
    });

    const unsubscribeChat = subscribeAdminSupportChatMessages((payload) => {
      if (payload.message?.senderType !== SUPPORT_CHAT_SENDER_TYPE.USER) return;
      playAdminNotificationSound();
      if (!isViewingAdminSupportTicket(payload.supportRequestId)) {
        refreshNotifications();
      }
    });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      unsubscribeNotifications();
      unsubscribeChat();
    };
  }, []);

  return children;
}
