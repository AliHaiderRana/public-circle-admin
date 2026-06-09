import { io, type Socket } from 'socket.io-client';
import { SOCKET_CHANNELS } from '@/lib/constants';

export type SupportChatSocketMessage = {
  _id: string;
  senderType: string;
  senderName: string;
  senderAdminId?: string;
  message: string;
  createdAt: string;
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

let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;

export async function getSupportSocket(): Promise<Socket | null> {
  if (socket?.connected) return socket;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.token) return null;

      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
      if (!serverUrl) return null;

      if (!socket) {
        socket = io(serverUrl, {
          query: {
            token: data.token,
            isAdmin: 'true',
          },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 8,
          reconnectionDelay: 1500,
        });
      } else {
        socket.io.opts.query = {
          token: data.token,
          isAdmin: 'true',
        };
        if (!socket.connected) {
          socket.connect();
        }
      }

      if (!socket.connected) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error('Socket timeout')), 10000);
          socket?.once('connect', () => {
            window.clearTimeout(timeout);
            resolve();
          });
          socket?.once('connect_error', (error) => {
            window.clearTimeout(timeout);
            reject(error);
          });
        });
      }

      return socket;
    } catch {
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
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

export function leaveSupportChatRoom(supportRequestId: string) {
  socket?.emit(SOCKET_CHANNELS.SUPPORT_CHAT_LEAVE, { supportRequestId });
}

export async function sendSupportChatMessage(
  supportRequestId: string,
  message: string,
): Promise<SupportChatSendAck> {
  const activeSocket = await getSupportSocket();
  if (!activeSocket) {
    throw new Error('Realtime connection unavailable');
  }

  return new Promise((resolve, reject) => {
    activeSocket.emit(
      SOCKET_CHANNELS.SUPPORT_CHAT_SEND,
      { supportRequestId, message },
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
  activeSocket: Socket,
  handler: (payload: {
    supportRequestId: string;
    message: SupportChatSocketMessage;
    emailSent?: boolean;
    userWasOnline?: boolean;
  }) => void,
) {
  activeSocket.on(SOCKET_CHANNELS.SUPPORT_CHAT_MESSAGE, handler);
  return () => {
    activeSocket.off(SOCKET_CHANNELS.SUPPORT_CHAT_MESSAGE, handler);
  };
}
