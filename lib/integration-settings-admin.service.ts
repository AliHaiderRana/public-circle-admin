import dbConnect from '@/lib/db';
import AppConfig from '@/lib/models/AppConfig';
import { clearServerSecretsCache } from '@/lib/server-secrets.server';
import {
  mergeAdminIntegrationEndpoints,
  type AdminIntegrationEndpoint,
  type PartnerSocketEvent,
} from '@/lib/partner-socket-events.catalog';
import {
  type AdminPortalIntegration,
  type IntegrationSettings,
  type PublicCircleServerIntegration,
  clearIntegrationSettingsCache,
  emptyIntegrationSettings,
  getIntegrationSettings,
} from '@/lib/integration-settings.service';

function resolveReferralBackendApiKey(
  incoming: string | undefined,
  existing: string | undefined,
): string {
  return incoming?.trim() || existing?.trim() || '';
}

function normalizeAdminManagedPortal(
  value: Partial<AdminPortalIntegration> | undefined,
  existing: AdminPortalIntegration,
): AdminPortalIntegration {
  const defaults = emptyIntegrationSettings().adminPortal;

  const partnerPortalSsoSecret =
    value?.partnerPortalSsoSecret?.trim() ||
    existing.partnerPortalSsoSecret ||
    defaults.partnerPortalSsoSecret;

  // Keep legacy socket-key field in sync with the single shared secret.
  const partnerRealtimeSocketKey = partnerPortalSsoSecret;
  const enabled = value?.enabled ?? existing.enabled ?? defaults.enabled;
  const turningMainOn = enabled && !existing.enabled;
  const endpoints = mergeAdminIntegrationEndpoints(
    (value?.adminIntegrationEndpoints as AdminIntegrationEndpoint[] | undefined) ??
      (existing.adminIntegrationEndpoints as AdminIntegrationEndpoint[] | undefined),
    existing.adminIntegrationEndpoints as AdminIntegrationEndpoint[] | undefined,
  );
  const partnerSidebarEnabled = enabled
    ? (turningMainOn
      ? true
      : (value?.partnerSidebarEnabled ??
        existing.partnerSidebarEnabled ??
        defaults.partnerSidebarEnabled))
    : false;

  return {
    enabled,
    referralEnabled: existing.referralEnabled ?? defaults.referralEnabled,
    adminPortalUrl: value?.adminPortalUrl?.trim() ?? existing.adminPortalUrl ?? defaults.adminPortalUrl,
    adminApiBaseUrl: existing.adminApiBaseUrl ?? defaults.adminApiBaseUrl,
    partnerPortalSsoSecret,
    partnerSidebarLabel: existing.partnerSidebarLabel ?? defaults.partnerSidebarLabel,
    partnerSidebarEnabled,
    partnerRealtimeSocketUrl:
      value?.partnerRealtimeSocketUrl?.trim() ??
      existing.partnerRealtimeSocketUrl ??
      defaults.partnerRealtimeSocketUrl,
    partnerSocketAuthValidator:
      value?.partnerSocketAuthValidator?.trim() ??
      existing.partnerSocketAuthValidator ??
      defaults.partnerSocketAuthValidator,
    partnerRealtimeSocketKey,
    adminIntegrationEndpoints: endpoints.map((entry) => ({
      ...entry,
      adminEnabled:
        enabled &&
        (entry.kind !== 'http' || partnerSidebarEnabled) &&
        (turningMainOn || entry.adminEnabled !== false),
    })),
    referralBackendApiKey: resolveReferralBackendApiKey(
      value?.referralBackendApiKey,
      existing.referralBackendApiKey,
    ),
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
  const current = await getIntegrationSettings();
  const normalized: IntegrationSettings = {
    adminPortal: normalizeAdminManagedPortal(settings.adminPortal, current.adminPortal),
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
  const current = await getIntegrationSettings();
  const normalized = normalizeAdminManagedPortal(adminPortal, current.adminPortal);

  return writeIntegrationSettings({
    adminPortal: normalized,
    publicCircleServer: current.publicCircleServer,
  });
}

export async function saveManagedIntegrationSettings(
  settings: IntegrationSettings,
): Promise<IntegrationSettings> {
  const current = await getIntegrationSettings();
  const normalized: IntegrationSettings = {
    adminPortal: normalizeAdminManagedPortal(settings.adminPortal, current.adminPortal),
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
