import { getReferralDbConnection } from '@/lib/referral-db';
import {
  mergePartnerSocketEvents,
  type PartnerSocketEvent,
} from '@/lib/partner-socket-events.catalog';

export type AdminPortalIntegration = {
  enabled: boolean;
  referralEnabled: boolean;
  adminPortalUrl: string;
  adminApiBaseUrl: string;
  partnerPortalSsoSecret: string;
  partnerSidebarLabel: string;
  partnerSidebarEnabled: boolean;
  partnerRealtimeSocketUrl: string;
  partnerSocketAuthValidator: string;
  partnerRealtimeSocketKey: string;
  adminIntegrationEndpoints?: PartnerSocketEvent[];
  referralBackendApiKey: string;
};

export type PublicCircleServerIntegration = {
  enabled: boolean;
  serverBaseUrl: string;
  internalApiKey: string;
};

export type IntegrationSettings = {
  adminPortal: AdminPortalIntegration;
  publicCircleServer: PublicCircleServerIntegration;
};

const COLLECTION = 'Integration-Settings';
const CACHE_MS = 30_000;

let cachedSettings: { expiresAt: number; value: IntegrationSettings } | null = null;

export function emptyIntegrationSettings(): IntegrationSettings {
  return {
    adminPortal: {
      enabled: false,
      referralEnabled: false,
      adminPortalUrl: '',
      adminApiBaseUrl: '',
      partnerPortalSsoSecret: '',
      partnerSidebarLabel: 'Support & Customers',
      partnerSidebarEnabled: true,
      partnerRealtimeSocketUrl: '',
      partnerSocketAuthValidator: '',
      partnerRealtimeSocketKey: '',
      referralBackendApiKey: '',
    },
    publicCircleServer: {
      enabled: false,
      serverBaseUrl: '',
      internalApiKey: '',
    },
  };
}

function normalizeSettings(doc: {
  adminPortal?: Partial<AdminPortalIntegration>;
  publicCircleServer?: Partial<PublicCircleServerIntegration>;
} | null): IntegrationSettings {
  const defaults = emptyIntegrationSettings();
  const adminPortal = doc?.adminPortal ?? {};
  const publicCircleServer = doc?.publicCircleServer ?? {};

  return {
    adminPortal: {
      enabled: adminPortal.enabled ?? defaults.adminPortal.enabled,
      referralEnabled:
        adminPortal.referralEnabled ??
        adminPortal.enabled ??
        defaults.adminPortal.referralEnabled,
      adminPortalUrl: adminPortal.adminPortalUrl?.trim() ?? defaults.adminPortal.adminPortalUrl,
      adminApiBaseUrl: adminPortal.adminApiBaseUrl?.trim() ?? defaults.adminPortal.adminApiBaseUrl,
      partnerPortalSsoSecret:
        adminPortal.partnerPortalSsoSecret?.trim() ||
        adminPortal.partnerRealtimeSocketKey?.trim() ||
        defaults.adminPortal.partnerPortalSsoSecret,
      partnerSidebarLabel:
        adminPortal.partnerSidebarLabel?.trim() ?? defaults.adminPortal.partnerSidebarLabel,
      partnerSidebarEnabled:
        adminPortal.partnerSidebarEnabled ?? defaults.adminPortal.partnerSidebarEnabled,
      partnerRealtimeSocketUrl:
        adminPortal.partnerRealtimeSocketUrl?.trim() ?? defaults.adminPortal.partnerRealtimeSocketUrl,
      partnerSocketAuthValidator:
        adminPortal.partnerSocketAuthValidator?.trim() ??
        defaults.adminPortal.partnerSocketAuthValidator,
      partnerRealtimeSocketKey:
        adminPortal.partnerPortalSsoSecret?.trim() ||
        adminPortal.partnerRealtimeSocketKey?.trim() ||
        defaults.adminPortal.partnerRealtimeSocketKey,
      adminIntegrationEndpoints: mergePartnerSocketEvents(
        adminPortal.adminIntegrationEndpoints as PartnerSocketEvent[] | undefined,
      ),
      referralBackendApiKey:
        adminPortal.referralBackendApiKey?.trim() ?? defaults.adminPortal.referralBackendApiKey,
    },
    publicCircleServer: {
      enabled: publicCircleServer.enabled ?? defaults.publicCircleServer.enabled,
      serverBaseUrl:
        publicCircleServer.serverBaseUrl?.trim() ?? defaults.publicCircleServer.serverBaseUrl,
      internalApiKey:
        publicCircleServer.internalApiKey?.trim() ?? defaults.publicCircleServer.internalApiKey,
    },
  };
}

export function clearIntegrationSettingsCache(): void {
  cachedSettings = null;
}

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  const now = Date.now();
  if (cachedSettings && cachedSettings.expiresAt > now) {
    return cachedSettings.value;
  }

  const conn = await getReferralDbConnection();
  const doc = await conn.db.collection(COLLECTION).findOne({});
  const value = normalizeSettings(doc as {
    adminPortal?: Partial<AdminPortalIntegration>;
    publicCircleServer?: Partial<PublicCircleServerIntegration>;
  } | null);
  cachedSettings = { value, expiresAt: now + CACHE_MS };
  return value;
}

export async function getAdminPortalIntegration(): Promise<AdminPortalIntegration> {
  const settings = await getIntegrationSettings();
  return settings.adminPortal;
}

export async function getPartnerPortalSsoSecret(): Promise<string> {
  const adminPortal = await getAdminPortalIntegration();
  return (
    adminPortal.partnerPortalSsoSecret?.trim() ||
    adminPortal.partnerRealtimeSocketKey?.trim() ||
    ''
  );
}
