'use client';

import { useEffect } from 'react';
import {
  ensureAdminNotificationSocket,
  subscribeAdminNotifications,
  subscribeAdminSupportChatMessages,
  subscribeAdminSupportChatPurged,
  subscribeAdminSupportTicketStatus,
  type AdminNotificationPayload,
} from '@/lib/admin-notification-socket';
import {
  broadcastAdminNotificationTabEvent,
  onAdminNotificationTabCreated,
} from '@/lib/admin-notification-tab-sync';
import { broadcastAdminSupportTabEvent } from '@/lib/support-tab-sync';

/**
 * Each admin tab opens its own socket; the server emits to all of them.
 * BroadcastChannel keeps tabs in sync when one tab receives an event or
 * performs a local mutation (status change, send message, delete ticket).
 */
export function useAdminSupportRealtimeSync() {
  useEffect(() => {
    void ensureAdminNotificationSocket();

    const unsubscribeNotifications = subscribeAdminNotifications(
      (notification: AdminNotificationPayload) => {
        broadcastAdminNotificationTabEvent({
          type: 'NOTIFICATION_CREATED',
          notification,
        });
      },
    );

    const unsubscribeChat = subscribeAdminSupportChatMessages((payload) => {
      if (!payload.message) return;
      broadcastAdminSupportTabEvent({
        type: 'CHAT_MESSAGE',
        supportRequestId: payload.supportRequestId,
        message: payload.message,
      });
      broadcastAdminSupportTabEvent({ type: 'INVALIDATE_REQUESTS' });
      broadcastAdminSupportTabEvent({ type: 'INVALIDATE_STATS' });
    });

    const unsubscribeStatus = subscribeAdminSupportTicketStatus((payload) => {
      broadcastAdminSupportTabEvent({
        type: 'TICKET_STATUS',
        supportRequestId: payload.supportRequestId,
        status: payload.status,
        pendingResolutionAt: payload.pendingResolutionAt,
        autoResolveAt: payload.autoResolveAt,
      });
      broadcastAdminSupportTabEvent({ type: 'INVALIDATE_REQUESTS' });
      broadcastAdminSupportTabEvent({ type: 'INVALIDATE_STATS' });
    });

    const unsubscribePurged = subscribeAdminSupportChatPurged((payload) => {
      broadcastAdminSupportTabEvent({
        type: 'CHAT_PURGED',
        supportRequestId: payload.supportRequestId,
        purgedAt: payload.purgedAt,
      });
      broadcastAdminSupportTabEvent({ type: 'INVALIDATE_REQUESTS' });
      broadcastAdminSupportTabEvent({ type: 'INVALIDATE_STATS' });
    });

    const unsubscribeTabNotifications = onAdminNotificationTabCreated((notification) => {
      window.dispatchEvent(
        new CustomEvent('admin-notifications:incoming', { detail: notification }),
      );
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeChat();
      unsubscribeStatus();
      unsubscribePurged();
      unsubscribeTabNotifications();
    };
  }, []);
}
