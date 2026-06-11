import type { Socket } from 'socket.io-client';
import { SOCKET_CHANNELS } from '@/lib/constants';
import {
  ensureAdminNotificationSocket,
  subscribeAdminSupportChatMessages,
} from '@/lib/admin-notification-socket';

export type SupportChatSocketMessage = {
  _id: string;
  senderType: string;
  senderName: string;
  senderAdminId?: string;
  message: string;
  createdAt: string;
  visibility?: 'CUSTOMER' | 'INTERNAL';
  emailSent?: boolean;
  userWasOnline?: boolean;
};

type SupportChatSendAck = {
  ok: boolean;
  error?: string;
  supportRequestId?: string;
  message?: SupportChatSocketMessage;
  emailSent?: boolean;
  userWasOnline?: boolean;
};

export async function getSupportSocket(): Promise<Socket | null> {
  return ensureAdminNotificationSocket();
}

export async function joinSupportChatRoom(supportRequestId: string) {
  const activeSocket = await getSupportSocket();
  if (!activeSocket) return false;

  return new Promise<boolean>((resolve) => {
    activeSocket.emit(
      SOCKET_CHANNELS.SUPPORT_CHAT_JOIN,
      { supportRequestId },
      (ack?: { ok?: boolean }) => {
        resolve(Boolean(ack?.ok));
      },
    );
  });
}

export async function leaveSupportChatRoom(supportRequestId: string) {
  const activeSocket = await getSupportSocket();
  activeSocket?.emit(SOCKET_CHANNELS.SUPPORT_CHAT_LEAVE, { supportRequestId });
}

export async function sendSupportChatMessage(
  supportRequestId: string,
  message: string,
  options: {
    internal?: boolean;
    attachment?: {
      s3Path: string;
      originalName: string;
      contentType: string;
      size: number;
    };
  } = {},
): Promise<SupportChatSendAck> {
  const activeSocket = await getSupportSocket();
  if (!activeSocket) {
    throw new Error('Realtime connection unavailable');
  }

  return new Promise((resolve, reject) => {
    activeSocket.emit(
      SOCKET_CHANNELS.SUPPORT_CHAT_SEND,
      {
        supportRequestId,
        message,
        internal: Boolean(options.internal),
        attachment: options.attachment,
      },
      (ack?: SupportChatSendAck) => {
        if (ack?.ok) {
          resolve(ack);
          return;
        }
        reject(new Error(ack?.error || 'Failed to send message'));
      },
    );
  });
}

export function subscribeSupportChatMessage(
  _activeSocket: Socket,
  handler: (payload: {
    supportRequestId: string;
    message: SupportChatSocketMessage;
    emailSent?: boolean;
    userWasOnline?: boolean;
  }) => void,
) {
  return subscribeAdminSupportChatMessages(handler);
}
