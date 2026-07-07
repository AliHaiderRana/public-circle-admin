'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Plug, RefreshCw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { IntegrationDocsPanel } from '@/components/integrations/integration-docs-panel';
import { PartnerSocketEventsPanel } from '@/components/integrations/partner-socket-events-panel';
import { SecretInput } from '@/components/integrations/secret-input';
import {
  mergePartnerSocketEvents,
  type PartnerSocketEvent,
} from '@/lib/partner-socket-events.catalog';
import { isAdminIntegrationsEnabled } from '@/lib/feature-flags';

type AdminPortalSettings = {
  enabled: boolean;
  referralEnabled: boolean;
  adminPortalUrl: string;
  partnerPortalSsoSecret: string;
  partnerSidebarLabel: string;
  partnerSidebarEnabled: boolean;
  referralBackendApiKey: string;
  partnerRealtimeSocketUrl?: string;
  partnerSocketAuthValidator?: string;
  partnerRealtimeSocketKey?: string;
  adminIntegrationEndpoints?: PartnerSocketEvent[];
};

type PublicCircleServerSettings = {
  enabled: boolean;
  serverBaseUrl: string;
  internalApiKey: string;
};

type IntegrationSettings = {
  adminPortal: AdminPortalSettings;
  publicCircleServer: PublicCircleServerSettings;
};

type ToggleConfirm =
  | { type: 'partnerEnabled'; next: boolean }
  | { type: 'serverEnabled'; next: boolean };

const emptySettings = (): IntegrationSettings => ({
  adminPortal: {
    enabled: false,
    referralEnabled: false,
    adminPortalUrl: '',
    partnerPortalSsoSecret: '',
    partnerSidebarLabel: 'Support & Customers',
    partnerSidebarEnabled: true,
    referralBackendApiKey: '',
  },
  publicCircleServer: {
    enabled: false,
    serverBaseUrl: '',
    internalApiKey: '',
  },
});

function randomApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isServerSettingsDirty(
  current: PublicCircleServerSettings,
  saved: PublicCircleServerSettings,
): boolean {
  return (
    current.enabled !== saved.enabled ||
    current.serverBaseUrl.trim() !== saved.serverBaseUrl.trim() ||
    current.internalApiKey !== saved.internalApiKey
  );
}

function isPartnerPortalDirty(
  current: AdminPortalSettings,
  saved: AdminPortalSettings,
): boolean {
  return (
    current.enabled !== saved.enabled ||
    current.adminPortalUrl.trim() !== saved.adminPortalUrl.trim() ||
    current.partnerPortalSsoSecret !== saved.partnerPortalSsoSecret
  );
}

function IntegrationSaveFooter({
  dirty,
  saving,
  message,
  onSave,
  saveLabel,
}: {
  dirty: boolean;
  saving: boolean;
  message: string | null;
  onSave: () => void;
  saveLabel: string;
}) {
  const statusText =
    message && !dirty
      ? message
      : dirty
        ? 'Unsaved changes — save to apply.'
        : 'No pending changes.';

  return (
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p
        className={`text-sm ${
          message?.includes('Failed') && !dirty
            ? 'text-destructive'
            : dirty
              ? 'font-medium text-amber-700 dark:text-amber-400'
              : 'text-muted-foreground'
        }`}
      >
        {statusText}
      </p>
      <Button
        onClick={onSave}
        disabled={!dirty || saving}
        variant={dirty ? 'default' : 'secondary'}
        size="sm"
        className="sm:ml-auto"
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : dirty ? (
          <span className="mr-2 size-2 shrink-0 animate-pulse rounded-full bg-amber-300" />
        ) : null}
        {saveLabel}
      </Button>
    </div>
  );
}

export default function IntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<IntegrationSettings>(emptySettings());
  const [savedSettings, setSavedSettings] = useState<IntegrationSettings>(emptySettings());
  const [loading, setLoading] = useState(true);
  const [savingServer, setSavingServer] = useState(false);
  const [savingPartner, setSavingPartner] = useState(false);
  const [serverSaveMessage, setServerSaveMessage] = useState<string | null>(null);
  const [partnerSaveMessage, setPartnerSaveMessage] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);
  const [regenerateSocketKeyConfirm, setRegenerateSocketKeyConfirm] = useState(false);
  const [socketEvents, setSocketEvents] = useState<PartnerSocketEvent[]>([]);
  const [savedSocketEvents, setSavedSocketEvents] = useState<PartnerSocketEvent[]>([]);
  const [savingSocketEvents, setSavingSocketEvents] = useState(false);
  const [socketSaveMessage, setSocketSaveMessage] = useState<string | null>(null);

  const serverDirty = useMemo(
    () => isServerSettingsDirty(settings.publicCircleServer, savedSettings.publicCircleServer),
    [settings.publicCircleServer, savedSettings.publicCircleServer],
  );

  const partnerDirty = useMemo(
    () => isPartnerPortalDirty(settings.adminPortal, savedSettings.adminPortal),
    [settings.adminPortal, savedSettings.adminPortal],
  );

  const socketEventsDirty = useMemo(() => {
    const current = {
      events: socketEvents,
      partnerRealtimeSocketUrl: settings.adminPortal.partnerRealtimeSocketUrl ?? '',
      partnerSocketAuthValidator: settings.adminPortal.partnerSocketAuthValidator ?? '',
      partnerRealtimeSocketKey: settings.adminPortal.partnerRealtimeSocketKey ?? '',
    };
    const saved = {
      events: savedSocketEvents,
      partnerRealtimeSocketUrl: savedSettings.adminPortal.partnerRealtimeSocketUrl ?? '',
      partnerSocketAuthValidator: savedSettings.adminPortal.partnerSocketAuthValidator ?? '',
      partnerRealtimeSocketKey: savedSettings.adminPortal.partnerRealtimeSocketKey ?? '',
    };
    return JSON.stringify(current) !== JSON.stringify(saved);
  }, [
    socketEvents,
    savedSocketEvents,
    settings.adminPortal.partnerRealtimeSocketUrl,
    settings.adminPortal.partnerSocketAuthValidator,
    settings.adminPortal.partnerRealtimeSocketKey,
    savedSettings.adminPortal.partnerRealtimeSocketUrl,
    savedSettings.adminPortal.partnerSocketAuthValidator,
    savedSettings.adminPortal.partnerRealtimeSocketKey,
  ]);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!isAdminIntegrationsEnabled()) {
      router.replace('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      void fetchSettings();
    }
  }, [user]);

  if (authLoading || !user?.isSuperAdmin || !isAdminIntegrationsEnabled()) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load integrations');
      const loaded: IntegrationSettings = {
        adminPortal: { ...emptySettings().adminPortal, ...(data.adminPortal ?? {}) },
        publicCircleServer: {
          ...emptySettings().publicCircleServer,
          ...(data.publicCircleServer ?? {}),
        },
      };
      setSettings(loaded);
      setSavedSettings(loaded);
      const mergedSocketEvents = mergePartnerSocketEvents(
        loaded.adminPortal.adminIntegrationEndpoints,
      );
      setSocketEvents(mergedSocketEvents);
      setSavedSocketEvents(mergedSocketEvents);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveServer() {
    setSavingServer(true);
    setServerSaveMessage(null);
    try {
      const res = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'publicCircleServer',
          ...settings.publicCircleServer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save server integration');
      const nextServer = {
        ...emptySettings().publicCircleServer,
        ...(data.publicCircleServer ?? {}),
      };
      setSettings((prev) => ({
        ...prev,
        publicCircleServer: nextServer,
      }));
      setSavedSettings((prev) => ({
        ...prev,
        publicCircleServer: nextServer,
      }));
      setServerSaveMessage('Server integration settings saved.');
    } catch (error) {
      console.error(error);
      setServerSaveMessage('Failed to save server integration settings.');
    } finally {
      setSavingServer(false);
    }
  }

  async function handleSavePartner() {
    setSavingPartner(true);
    setPartnerSaveMessage(null);
    try {
      const res = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'adminPortal',
          ...settings.adminPortal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save partner portal settings');
      const nextPartner = { ...emptySettings().adminPortal, ...(data.adminPortal ?? {}) };
      setSettings((prev) => ({
        ...prev,
        adminPortal: nextPartner,
      }));
      setSavedSettings((prev) => ({
        ...prev,
        adminPortal: nextPartner,
      }));
      setPartnerSaveMessage('Partner portal settings saved. Partner access updates after save.');
    } catch (error) {
      console.error(error);
      setPartnerSaveMessage('Failed to save partner portal settings.');
    } finally {
      setSavingPartner(false);
    }
  }

  async function handleSaveSocketEvents() {
    setSavingSocketEvents(true);
    setSocketSaveMessage(null);
    try {
      const res = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'adminPortal',
          adminIntegrationEndpoints: socketEvents,
          partnerRealtimeSocketUrl: settings.adminPortal.partnerRealtimeSocketUrl,
          partnerSocketAuthValidator: settings.adminPortal.partnerSocketAuthValidator,
          partnerRealtimeSocketKey: settings.adminPortal.partnerRealtimeSocketKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save socket events');
      const merged = mergePartnerSocketEvents(data.adminPortal?.adminIntegrationEndpoints);
      setSocketEvents(merged);
      setSavedSocketEvents(merged);
      setSettings((prev) => ({
        ...prev,
        adminPortal: { ...prev.adminPortal, adminIntegrationEndpoints: merged },
      }));
      setSavedSettings((prev) => ({
        ...prev,
        adminPortal: {
          ...prev.adminPortal,
          adminIntegrationEndpoints: merged,
          partnerRealtimeSocketUrl: data.adminPortal?.partnerRealtimeSocketUrl ?? '',
          partnerSocketAuthValidator: data.adminPortal?.partnerSocketAuthValidator ?? '',
          partnerRealtimeSocketKey: data.adminPortal?.partnerRealtimeSocketKey ?? '',
        },
      }));
      setSocketSaveMessage('Partner socket events saved.');
    } catch (error) {
      console.error(error);
      setSocketSaveMessage('Failed to save partner socket events.');
    } finally {
      setSavingSocketEvents(false);
    }
  }

  function applyToggleConfirm() {
    if (!toggleConfirm) return;

    if (toggleConfirm.type === 'partnerEnabled') {
      setSettings((prev) => ({
        ...prev,
        adminPortal: { ...prev.adminPortal, enabled: toggleConfirm.next },
      }));
    } else if (toggleConfirm.type === 'serverEnabled') {
      setSettings((prev) => ({
        ...prev,
        publicCircleServer: { ...prev.publicCircleServer, enabled: toggleConfirm.next },
      }));
    }

    setToggleConfirm(null);
  }

  function requestToggle(type: ToggleConfirm['type'], next: boolean, current: boolean) {
    if (next === current) return;
    setToggleConfirm({ type, next } as ToggleConfirm);
  }

  const server = settings.publicCircleServer;
  const partner = settings.adminPortal;

  const toggleCopy =
    toggleConfirm?.type === 'partnerEnabled'
      ? {
          title: toggleConfirm.next ? 'Enable partner handoff (admin)?' : 'Disable partner handoff (admin)?',
          description: toggleConfirm.next
            ? 'Partners can access this admin portal after you save and the referral app also enables handoff.'
            : 'After you save, new partner handoffs are blocked and existing partner admin sessions will end on their next request.',
        }
      : toggleConfirm?.type === 'serverEnabled'
        ? {
            title: toggleConfirm.next ? 'Enable server integration?' : 'Disable server integration?',
            description: toggleConfirm.next
              ? 'Admin will proxy provisioning and ticket updates to the Public Circle server after you save.'
              : 'Server-backed provisioning and ticket updates will stop after you save.',
          }
        : null;

  const handoffReady =
    partner.enabled &&
    partner.referralEnabled &&
    partner.adminPortalUrl?.trim() &&
    partner.partnerPortalSsoSecret?.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Plug className="h-6 w-6" />
          Integrations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each integration has its own save button. Toggle changes are not live until you save that
          section.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Public Circle server</CardTitle>
              <CardDescription>
                Used by this admin app when proxying provisioning and ticket updates. The referral
                app never calls the server directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="server-enabled">Enable server integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Required for provisioning and ticket updates proxied through admin.
                  </p>
                </div>
                <Switch
                  id="server-enabled"
                  checked={server.enabled}
                  onCheckedChange={(checked) =>
                    requestToggle('serverEnabled', checked, server.enabled)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-base-url">Server base URL</Label>
                <Input
                  id="server-base-url"
                  placeholder="https://api.example.com"
                  value={server.serverBaseUrl}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      publicCircleServer: {
                        ...prev.publicCircleServer,
                        serverBaseUrl: event.target.value,
                      },
                    }))
                  }
                />
              </div>
              <SecretInput
                id="internal-api-key"
                label="Internal API key"
                value={server.internalApiKey}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    publicCircleServer: { ...prev.publicCircleServer, internalApiKey: value },
                  }))
                }
                helperText="Sent as X-Internal-API-Key when admin calls the Public Circle server."
              />
              <IntegrationSaveFooter
                dirty={serverDirty}
                saving={savingServer}
                message={serverSaveMessage}
                onSave={handleSaveServer}
                saveLabel="Save server settings"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integration settings</CardTitle>
              <CardDescription>
                Admin-side handoff acceptance. Both this toggle and referral app → Integrations must
                be enabled for partners to access this portal. Sidebar label lives in the referral
                app only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4 text-sm">
                <span className="text-muted-foreground">Referral app handoff:</span>
                <span
                  className={
                    partner.referralEnabled
                      ? 'font-medium text-green-700'
                      : 'font-medium text-muted-foreground'
                  }
                >
                  {partner.referralEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {handoffReady ? 'Ready for partners' : 'Not ready — enable both apps'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="partner-enabled">Enable partner handoff (admin portal)</Label>
                  <p className="text-sm text-muted-foreground">
                    Allows this admin portal to accept partner handoff from the referral app using
                    the shared API key.
                  </p>
                </div>
                <Switch
                  id="partner-enabled"
                  checked={partner.enabled}
                  onCheckedChange={(checked) =>
                    requestToggle('partnerEnabled', checked, partner.enabled)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-portal-url">Admin portal URL</Label>
                <Input
                  id="admin-portal-url"
                  placeholder="https://admin.example.com"
                  value={partner.adminPortalUrl}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      adminPortal: { ...prev.adminPortal, adminPortalUrl: event.target.value },
                    }))
                  }
                />
              </div>

              <SecretInput
                id="partner-api-key"
                label="Partner API key"
                value={partner.partnerPortalSsoSecret}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    adminPortal: { ...prev.adminPortal, partnerPortalSsoSecret: value },
                  }))
                }
                helperText="Shared with the referral app. Used to sign short-lived partner handoff tokens."
              />

              <IntegrationSaveFooter
                dirty={partnerDirty}
                saving={savingPartner}
                message={partnerSaveMessage}
                onSave={handleSavePartner}
                saveLabel="Save partner portal settings"
              />
            </CardContent>
          </Card>

          <PartnerSocketEventsPanel
            events={socketEvents}
            saving={savingSocketEvents}
            dirty={socketEventsDirty}
            onChange={setSocketEvents}
            onSave={() => void handleSaveSocketEvents()}
            adminPortalUrl={partner.adminPortalUrl}
            partnerRealtimeSocketUrl={settings.adminPortal.partnerRealtimeSocketUrl}
            partnerSocketAuthValidator={settings.adminPortal.partnerSocketAuthValidator}
            partnerRealtimeSocketKey={settings.adminPortal.partnerRealtimeSocketKey}
            onPartnerRealtimeSocketUrlChange={(value) =>
              setSettings((prev) => ({
                ...prev,
                adminPortal: { ...prev.adminPortal, partnerRealtimeSocketUrl: value },
              }))
            }
            onPartnerSocketAuthValidatorChange={(value) =>
              setSettings((prev) => ({
                ...prev,
                adminPortal: { ...prev.adminPortal, partnerSocketAuthValidator: value },
              }))
            }
            onRegenerateSocketKey={() => setRegenerateSocketKeyConfirm(true)}
          />

          {socketSaveMessage ? (
            <p
              className={`text-sm ${
                socketSaveMessage.includes('Failed')
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`}
            >
              {socketSaveMessage}
            </p>
          ) : null}

          <IntegrationDocsPanel
            adminPortalUrl={partner.adminPortalUrl}
            serverBaseUrl={server.serverBaseUrl}
            partnerEnabled={partner.enabled}
            referralEnabled={partner.referralEnabled}
            partnerPortalSsoSecret={partner.partnerPortalSsoSecret}
            serverEnabled={server.enabled}
            internalApiKey={server.internalApiKey}
          />
        </>
      )}

      <AlertDialog
        open={Boolean(toggleConfirm)}
        onOpenChange={(open) => {
          if (!open) setToggleConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{toggleCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyToggleConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={regenerateSocketKeyConfirm} onOpenChange={setRegenerateSocketKeyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate partner socket key?</AlertDialogTitle>
            <AlertDialogDescription>
              The referral app must use the new key after you save. Live badge counts will fail until
              both sides are updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSettings((prev) => ({
                  ...prev,
                  adminPortal: {
                    ...prev.adminPortal,
                    partnerRealtimeSocketKey: randomApiKey(),
                  },
                }));
                setRegenerateSocketKeyConfirm(false);
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
