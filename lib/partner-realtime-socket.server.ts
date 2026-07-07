import type { Server as HttpServer } from 'http';
import { Server, type Namespace } from 'socket.io';
import { getAdminPortalIntegration } from '@/lib/integration-settings.service';
import { getReferralPartnerSupportStats } from '@/lib/referral-partner-stats.server';
import {
  getEnabledEmitEvents,
  getEnabledListenEvents,
} from '@/lib/partner-socket-events.catalog';
import {
  PARTNER_REALTIME_NAMESPACE,
} from '@/lib/partner-realtime.constant';
import { isPartnerStatsDeliveryEnabled } from '@/lib/partner-handoff.util';
import { resolvePartnerRealtimeSocketUser } from '@/lib/partner-realtime-socket-auth.server';

let partnerNamespace: Namespace | null = null;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 400;

async function emitPartnerRealtimeStats(referralUserId: string): Promise<void> {
  if (!partnerNamespace || !referralUserId) return;

  try {
    const adminPortal = await getAdminPortalIntegration();
    if (!isPartnerStatsDeliveryEnabled(adminPortal)) {
      return;
    }

    const endpoints = adminPortal.adminIntegrationEndpoints ?? [];
    const listenEvents = new Set(getEnabledListenEvents(endpoints));
    const stats = await getReferralPartnerSupportStats(referralUserId);
    const room = `partner:${referralUserId}`;

    endpoints
      .filter((entry) => entry.enabled && entry.kind === 'socket-listen' && listenEvents.has(entry.path))
      .forEach((entry) => {
        const count =
          entry.id === 'socket-unread-messages'
            ? stats.unreadChatMessages
            : entry.id === 'socket-open-tickets'
              ? stats.openSupportRequests
              : 0;

        partnerNamespace?.to(room).emit(entry.path, { count });
      });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[partner-realtime] failed to emit stats:', error);
    }
  }
}

export function schedulePartnerRealtimeStatsPush(referralUserId: string): void {
  const id = String(referralUserId || '').trim();
  if (!id) return;

  const existing = debounceTimers.get(id);
  if (existing) clearTimeout(existing);

  debounceTimers.set(
    id,
    setTimeout(() => {
      debounceTimers.delete(id);
      void emitPartnerRealtimeStats(id);
    }, DEBOUNCE_MS),
  );
}

export function attachPartnerRealtimeSocket(httpServer: HttpServer): void {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: true,
      credentials: true,
    },
  });

  partnerNamespace = io.of(PARTNER_REALTIME_NAMESPACE);

  partnerNamespace.use(async (socket, next) => {
    const adminPortal = await getAdminPortalIntegration();
    const expectedSocketKey = adminPortal.partnerRealtimeSocketKey?.trim();
    const rawSocketKey = socket.handshake.auth?.socketKey ?? socket.handshake.query?.socketKey;
    const socketKey = typeof rawSocketKey === 'string' ? rawSocketKey.trim() : '';

    if (!expectedSocketKey || socketKey !== expectedSocketKey) {
      next(new Error('Unauthorized'));
      return;
    }

    const rawToken = socket.handshake.auth?.token ?? socket.handshake.query?.token;
    const token = typeof rawToken === 'string' ? rawToken : '';
    const user = await resolvePartnerRealtimeSocketUser(token);
    if (!user) {
      next(new Error('Unauthorized'));
      return;
    }
    socket.data.user = user;
    next();
  });

  partnerNamespace.on('connection', (socket) => {
    const user = socket.data.user as { referralUserId: string };
    const room = `partner:${user.referralUserId}`;
    void socket.join(room);

    const pushStats = () => emitPartnerRealtimeStats(user.referralUserId);

    void pushStats();

    void (async () => {
      const adminPortal = await getAdminPortalIntegration();
      const emitEvents = getEnabledEmitEvents(adminPortal.adminIntegrationEndpoints ?? []);

      emitEvents.forEach((eventName) => {
        socket.on(eventName, async () => {
          const latestPortal = await getAdminPortalIntegration();
          const enabledEmitEvents = new Set(
            getEnabledEmitEvents(latestPortal.adminIntegrationEndpoints ?? []),
          );
          if (!enabledEmitEvents.has(eventName)) {
            return;
          }
          void pushStats();
        });
      });
    })();
  });
}
