import dbConnect from '@/lib/db';
import AppConfig from '@/lib/models/AppConfig';
import { clearServerSecretsCache } from '@/lib/server-secrets.server';
import {
  type AdminPortalIntegration,
  type IntegrationSettings,
  type PublicCircleServerIntegration,
  clearIntegrationSettingsCache,
  emptyIntegrationSettings,
  getIntegrationSettings,
} from '@/lib/integration-settings.service';

function normalizeAdminPortal(
  value: Partial<AdminPortalIntegration> | undefined,
): AdminPortalIntegration {
  const defaults = emptyIntegrationSettings().adminPortal;
  return {
    enabled: value?.enabled ?? defaults.enabled,
    adminPortalUrl: value?.adminPortalUrl?.trim() ?? defaults.adminPortalUrl,
    partnerPortalSsoSecret:
      value?.partnerPortalSsoSecret?.trim() ?? defaults.partnerPortalSsoSecret,
    partnerSidebarLabel: value?.partnerSidebarLabel?.trim() ?? defaults.partnerSidebarLabel,
    partnerSidebarEnabled: value?.partnerSidebarEnabled ?? defaults.partnerSidebarEnabled,
  };
}

function normalizePublicCircleServer(
  value: Partial<PublicCircleServerIntegration> | undefined,
): PublicCircleServerIntegration {
  const defaults = emptyIntegrationSettings().publicCircleServer;
  return {
    enabled: value?.enabled ?? defaults.enabled,
    serverBaseUrl: value?.serverBaseUrl?.trim() ?? defaults.serverBaseUrl,
    internalApiKey: value?.internalApiKey?.trim() ?? defaults.internalApiKey,
  };
}

async function writeIntegrationSettings(settings: IntegrationSettings): Promise<IntegrationSettings> {
  const conn = await import('@/lib/referral-db').then((m) => m.getReferralDbConnection());
  const normalized: IntegrationSettings = {
    adminPortal: normalizeAdminPortal(settings.adminPortal),
    publicCircleServer: normalizePublicCircleServer(settings.publicCircleServer),
  };

  await conn.db.collection('Integration-Settings').updateOne(
    {},
    { $set: { ...normalized, updatedAt: new Date() } },
    { upsert: true },
  );

  clearIntegrationSettingsCache();
  return normalized;
}

export async function getManagedIntegrationSettings(): Promise<IntegrationSettings> {
  const settings = await getIntegrationSettings();

  await dbConnect();
  const config = (await AppConfig.findOne().lean()) as Record<string, unknown> | null;
  const serverBaseUrl = String(config?.serverBaseUrl || "").trim();
  const internalApiKey = String(config?.internalApiKey || "").trim();

  return {
    adminPortal: settings.adminPortal,
    publicCircleServer: {
      enabled: settings.publicCircleServer.enabled,
      serverBaseUrl: serverBaseUrl || settings.publicCircleServer.serverBaseUrl,
      internalApiKey: internalApiKey || settings.publicCircleServer.internalApiKey,
    },
  };
}

export async function savePublicCircleServerIntegration(
  publicCircleServer: PublicCircleServerIntegration,
): Promise<IntegrationSettings> {
  await dbConnect();
  const normalized = normalizePublicCircleServer(publicCircleServer);
  const current = await getIntegrationSettings();

  await AppConfig.findOneAndUpdate(
    {},
    {
      $set: {
        serverBaseUrl: normalized.serverBaseUrl,
        internalApiKey: normalized.internalApiKey,
      },
    },
    { upsert: true, new: true },
  );

  clearServerSecretsCache();

  return writeIntegrationSettings({
    adminPortal: current.adminPortal,
    publicCircleServer: normalized,
  });
}

export async function saveAdminPortalIntegration(
  adminPortal: AdminPortalIntegration,
): Promise<IntegrationSettings> {
  const normalized = normalizeAdminPortal(adminPortal);
  const current = await getIntegrationSettings();

  return writeIntegrationSettings({
    adminPortal: normalized,
    publicCircleServer: current.publicCircleServer,
  });
}

export async function saveManagedIntegrationSettings(
  settings: IntegrationSettings,
): Promise<IntegrationSettings> {
  const normalized: IntegrationSettings = {
    adminPortal: normalizeAdminPortal(settings.adminPortal),
    publicCircleServer: normalizePublicCircleServer(settings.publicCircleServer),
  };

  await dbConnect();
  await AppConfig.findOneAndUpdate(
    {},
    {
      $set: {
        serverBaseUrl: normalized.publicCircleServer.serverBaseUrl,
        internalApiKey: normalized.publicCircleServer.internalApiKey,
      },
    },
    { upsert: true, new: true },
  );
  clearServerSecretsCache();

  return writeIntegrationSettings(normalized);
}
