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
import { resolvePublicCircleServerOrigin } from '@/lib/public-circle-server-url.util';

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
  existing?: PublicCircleServerIntegration,
): PublicCircleServerIntegration {
  const defaults = emptyIntegrationSettings().publicCircleServer;
  const prior = existing ?? defaults;
  const nextUrl =
    value?.serverBaseUrl !== undefined
      ? value.serverBaseUrl.trim().replace(/\/$/, '')
      : prior.serverBaseUrl;
  const nextKey =
    value?.internalApiKey !== undefined && value.internalApiKey.trim()
      ? value.internalApiKey.trim()
      : prior.internalApiKey;
  const nextPanelTitle =
    value?.panelTitle !== undefined
      ? value.panelTitle.trim() || defaults.panelTitle
      : prior.panelTitle || defaults.panelTitle;
  const nextPanelDescription =
    value?.panelDescription !== undefined
      ? value.panelDescription.trim() || defaults.panelDescription
      : prior.panelDescription || defaults.panelDescription;
  const ready = Boolean(nextUrl && nextKey);
  const requestedEnabled = value?.enabled ?? prior.enabled;
  return {
    enabled: ready ? Boolean(requestedEnabled) : false,
    serverBaseUrl: nextUrl,
    internalApiKey: nextKey,
    panelTitle: nextPanelTitle,
    panelDescription: nextPanelDescription,
  };
}

/** Sync impressions auth into every Referral company Integration-Settings doc. */
async function syncPublicCircleServerToReferralCompanies(
  publicCircleServer: PublicCircleServerIntegration,
): Promise<void> {
  const conn = await import('@/lib/referral-db').then((m) => m.getReferralDbConnection());
  const updatedAt = new Date();
  await conn.db.collection('Integration-Settings').updateMany(
    { companyId: { $exists: true, $ne: null } },
    {
      $set: {
        publicCircleServer,
        updatedAt,
      },
    },
  );
  clearIntegrationSettingsCache();
}

async function writeIntegrationSettings(settings: IntegrationSettings): Promise<IntegrationSettings> {
  const conn = await import('@/lib/referral-db').then((m) => m.getReferralDbConnection());
  const current = await getIntegrationSettings();
  const normalized: IntegrationSettings = {
    adminPortal: normalizeAdminManagedPortal(settings.adminPortal, current.adminPortal),
    publicCircleServer: normalizePublicCircleServer(
      settings.publicCircleServer,
      current.publicCircleServer,
    ),
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
  const secrets = await import('@/lib/server-secrets.server').then((m) => m.getServerSecrets());

  await dbConnect();
  const config = (await AppConfig.findOne().lean()) as Record<string, unknown> | null;
  const serverBaseUrl = String(config?.serverBaseUrl || '').trim();
  const internalApiKey = String(config?.internalApiKey || '').trim();

  return {
    adminPortal: settings.adminPortal,
    publicCircleServer: {
      enabled: settings.publicCircleServer.enabled,
      serverBaseUrl:
        serverBaseUrl ||
        settings.publicCircleServer.serverBaseUrl ||
        secrets.serverBaseUrl,
      internalApiKey:
        internalApiKey ||
        settings.publicCircleServer.internalApiKey ||
        secrets.internalApiKey,
      panelTitle: settings.publicCircleServer.panelTitle,
      panelDescription: settings.publicCircleServer.panelDescription,
    },
  };
}

export async function savePublicCircleServerIntegration(
  publicCircleServer: Partial<PublicCircleServerIntegration>,
): Promise<IntegrationSettings> {
  await dbConnect();
  const current = await getManagedIntegrationSettings();
  const normalized = normalizePublicCircleServer(
    publicCircleServer,
    current.publicCircleServer,
  );

  await AppConfig.findOneAndUpdate(
    {},
    {
      $set: {
        // AppConfig needs the API origin; Integration-Settings may store the full impressions URL.
        serverBaseUrl:
          resolvePublicCircleServerOrigin(normalized.serverBaseUrl) ||
          normalized.serverBaseUrl,
        internalApiKey: normalized.internalApiKey,
      },
    },
    { upsert: true, new: true },
  );

  clearServerSecretsCache();

  // Keep Referral company docs in sync so Reporting can authenticate with this key.
  await syncPublicCircleServerToReferralCompanies(normalized);

  return {
    adminPortal: current.adminPortal,
    publicCircleServer: normalized,
  };
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
  const current = await getManagedIntegrationSettings();
  const normalized: IntegrationSettings = {
    adminPortal: normalizeAdminManagedPortal(settings.adminPortal, current.adminPortal),
    publicCircleServer: normalizePublicCircleServer(
      settings.publicCircleServer,
      current.publicCircleServer,
    ),
  };

  await dbConnect();
  await AppConfig.findOneAndUpdate(
    {},
    {
      $set: {
        serverBaseUrl:
          resolvePublicCircleServerOrigin(normalized.publicCircleServer.serverBaseUrl) ||
          normalized.publicCircleServer.serverBaseUrl,
        internalApiKey: normalized.publicCircleServer.internalApiKey,
      },
    },
    { upsert: true, new: true },
  );
  clearServerSecretsCache();
  await syncPublicCircleServerToReferralCompanies(normalized.publicCircleServer);

  return writeIntegrationSettings(normalized);
}
