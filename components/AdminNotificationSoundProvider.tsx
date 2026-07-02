'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { unlockAdminNotificationSound, playAdminNotificationSound } from '@/lib/notification-sound';
import {
  ensureAdminNotificationSocket,
  subscribeAdminNotifications,
  subscribeAdminSupportChatMessages,
} from '@/lib/admin-notification-socket';
import { SUPPORT_CHAT_SENDER_TYPE } from '@/lib/constants';
import { isViewingAdminSupportTicket } from '@/lib/admin-support-view';
import { partnerCanAccessNotification } from '@/lib/partner-notifications.client.util';

type AdminNotificationSoundProviderProps = {
  children: ReactNode;
};

export function AdminNotificationSoundProvider({
  children,
}: AdminNotificationSoundProviderProps) {
  const { user } = useAuth();

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

    const partnerReferralUserId = user?.isPartner
      ? user?.referralUserId || user?.id
      : undefined;

    const unsubscribeNotifications = subscribeAdminNotifications((notification) => {
      if (
        partnerReferralUserId &&
        !partnerCanAccessNotification(partnerReferralUserId, notification.metadata)
      ) {
        return;
      }
      playAdminNotificationSound();
      refreshNotifications();
    });

    const unsubscribeChat = subscribeAdminSupportChatMessages((payload) => {
      if (partnerReferralUserId) {
        // Chat socket events are broadcast globally; partners use scoped notification events.
        return;
      }
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
  }, [user?.id, user?.isPartner, user?.referralUserId]);

  return children;
}
