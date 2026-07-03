import { getReferralDbConnection } from '@/lib/referral-db';

export type AdminPortalIntegration = {
  enabled: boolean;
  adminPortalUrl: string;
  partnerPortalSsoSecret: string;
  partnerSidebarLabel: string;
  partnerSidebarEnabled: boolean;
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
      adminPortalUrl: '',
      partnerPortalSsoSecret: '',
      partnerSidebarLabel: 'Support & Customers',
      partnerSidebarEnabled: true,
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
      adminPortalUrl: adminPortal.adminPortalUrl?.trim() ?? defaults.adminPortal.adminPortalUrl,
      partnerPortalSsoSecret:
        adminPortal.partnerPortalSsoSecret?.trim() ?? defaults.adminPortal.partnerPortalSsoSecret,
      partnerSidebarLabel:
        adminPortal.partnerSidebarLabel?.trim() ?? defaults.adminPortal.partnerSidebarLabel,
      partnerSidebarEnabled:
        adminPortal.partnerSidebarEnabled ?? defaults.adminPortal.partnerSidebarEnabled,
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
  return adminPortal.partnerPortalSsoSecret?.trim() || '';
}
