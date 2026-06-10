import { io, type Socket } from 'socket.io-client';
import { SOCKET_CHANNELS } from '@/lib/constants';
type SupportChatSocketMessage = {
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

export type AdminNotificationPayload = {
  _id: string;
  type: string;
  title: string;
  description: string;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type AdminNotificationListener = (notification: AdminNotificationPayload) => void;
type SupportChatListener = (payload: {
  supportRequestId: string;
  message: SupportChatSocketMessage;
  emailSent?: boolean;
  userWasOnline?: boolean;
}) => void;

const notificationListeners = new Set<AdminNotificationListener>();
const supportChatListeners = new Set<SupportChatListener>();
const connectionListeners = new Set<(connected: boolean) => void>();

let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;

function notifyConnection(connected: boolean) {
  connectionListeners.forEach((listener) => listener(connected));
}

function attachSocketHandlers(activeSocket: Socket) {
  activeSocket.off(SOCKET_CHANNELS.ADMIN_NOTIFICATION_CREATED);
  activeSocket.off(SOCKET_CHANNELS.SUPPORT_CHAT_MESSAGE);

  activeSocket.on(SOCKET_CHANNELS.ADMIN_NOTIFICATION_CREATED, (notification: AdminNotificationPayload) => {
    notificationListeners.forEach((listener) => listener(notification));
  });

  activeSocket.on(
    SOCKET_CHANNELS.SUPPORT_CHAT_MESSAGE,
    (payload: {
      supportRequestId: string;
      message: SupportChatSocketMessage;
      emailSent?: boolean;
      userWasOnline?: boolean;
    }) => {
      supportChatListeners.forEach((listener) => listener(payload));
    },
  );
}

export function subscribeAdminNotificationConnection(listener: (connected: boolean) => void) {
  connectionListeners.add(listener);
  void ensureAdminNotificationSocket().then((activeSocket) => {
    listener(Boolean(activeSocket?.connected));
  });

  return () => {
    connectionListeners.delete(listener);
  };
}

export function subscribeAdminNotifications(listener: AdminNotificationListener) {
  notificationListeners.add(listener);
  void ensureAdminNotificationSocket();

  return () => {
    notificationListeners.delete(listener);
  };
}

export function subscribeAdminSupportChatMessages(listener: SupportChatListener) {
  supportChatListeners.add(listener);
  void ensureAdminNotificationSocket();

  return () => {
    supportChatListeners.delete(listener);
  };
}

export async function ensureAdminNotificationSocket(): Promise<Socket | null> {
  if (socket?.connected) return socket;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.token) return null;

      const serverUrl =
        process.env.NEXT_PUBLIC_SERVER_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.SERVER_API_URL ||
        'http://localhost:3001';

      if (!socket) {
        socket = io(serverUrl, {
          query: {
            token: data.token,
            isAdmin: 'true',
          },
          transports: ['websocket', 'polling'],
          timeout: 20000,
          reconnection: true,
          reconnectionAttempts: 8,
          reconnectionDelay: 3000,
        });

        socket.on('connect', () => notifyConnection(true));
        socket.on('disconnect', () => notifyConnection(false));
        socket.on('connect_error', (error) => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[AdminSocket] connect_error:', error.message);
          }
          notifyConnection(false);
        });
        attachSocketHandlers(socket);
      } else {
        socket.io.opts.query = {
          token: data.token,
          isAdmin: 'true',
        };
        attachSocketHandlers(socket);
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
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[AdminSocket] Failed to connect:',
          error instanceof Error ? error.message : error,
        );
      }
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}
