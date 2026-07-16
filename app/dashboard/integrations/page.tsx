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
import { Loader2, Plug } from 'lucide-react';
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
import { PartnerSocketEventsPanel } from '@/components/integrations/partner-socket-events-panel';
import { SecretInput } from '@/components/integrations/secret-input';
import {
  mergePartnerSocketEvents,
  type AdminIntegrationEndpoint,
  type PartnerSocketEvent,
} from '@/lib/partner-socket-events.catalog';

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
  adminIntegrationEndpoints?: AdminIntegrationEndpoint[];
};

type IntegrationSettings = {
  adminPortal: AdminPortalSettings;
};

type ToggleConfirm = {
  kind: 'main' | 'portal' | 'socket' | 'event';
  next: boolean;
  events?: PartnerSocketEvent[];
};

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
});

function randomSecretKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function socketEventsFrom(
  endpoints?: AdminIntegrationEndpoint[] | null,
): PartnerSocketEvent[] {
  return mergePartnerSocketEvents(
    endpoints?.filter(
      (entry): entry is PartnerSocketEvent =>
        entry.kind === 'socket-listen' || entry.kind === 'socket-emit',
    ),
  ).map((event) => ({
    ...event,
    enabled: event.adminEnabled !== false,
  }));
}

function withAdminSocketState(
  endpoints: AdminIntegrationEndpoint[] | undefined,
  socketEvents: PartnerSocketEvent[],
): AdminIntegrationEndpoint[] {
  const enabledById = new Map(socketEvents.map((event) => [event.id, event.enabled]));
  return (endpoints ?? []).map((entry) =>
    entry.kind === 'socket-listen' || entry.kind === 'socket-emit'
      ? { ...entry, adminEnabled: enabledById.get(entry.id) ?? entry.adminEnabled ?? true }
      : entry,
  );
}

function isPartnerPortalDirty(current: AdminPortalSettings, saved: AdminPortalSettings): boolean {
  return (
    current.enabled !== saved.enabled ||
    current.partnerSidebarEnabled !== saved.partnerSidebarEnabled ||
    current.adminPortalUrl.trim() !== saved.adminPortalUrl.trim() ||
    current.partnerPortalSsoSecret !== saved.partnerPortalSsoSecret
  );
}

function SaveFooter({
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
      <Button type="button" onClick={onSave} disabled={!dirty || saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
  const [savingPartner, setSavingPartner] = useState(false);
  const [partnerSaveMessage, setPartnerSaveMessage] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);
  const [socketEvents, setSocketEvents] = useState<PartnerSocketEvent[]>([]);
  const [savedSocketEvents, setSavedSocketEvents] = useState<PartnerSocketEvent[]>([]);
  const [savingSocketEvents, setSavingSocketEvents] = useState(false);
  const [socketSaveMessage, setSocketSaveMessage] = useState<string | null>(null);

  const partnerDirty = useMemo(
    () => isPartnerPortalDirty(settings.adminPortal, savedSettings.adminPortal),
    [settings.adminPortal, savedSettings.adminPortal],
  );

  const socketEventsDirty = useMemo(() => {
    const current = {
      partnerRealtimeSocketUrl: settings.adminPortal.partnerRealtimeSocketUrl ?? '',
      partnerSocketAuthValidator: settings.adminPortal.partnerSocketAuthValidator ?? '',
      events: socketEvents,
    };
    const saved = {
      partnerRealtimeSocketUrl: savedSettings.adminPortal.partnerRealtimeSocketUrl ?? '',
      partnerSocketAuthValidator: savedSettings.adminPortal.partnerSocketAuthValidator ?? '',
      events: savedSocketEvents,
    };
    return JSON.stringify(current) !== JSON.stringify(saved);
  }, [
    settings.adminPortal.partnerRealtimeSocketUrl,
    settings.adminPortal.partnerSocketAuthValidator,
    socketEvents,
    savedSettings.adminPortal.partnerRealtimeSocketUrl,
    savedSettings.adminPortal.partnerSocketAuthValidator,
    savedSocketEvents,
  ]);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      void fetchSettings();
    }
  }, [user]);

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
      };
      setSettings(loaded);
      setSavedSettings(loaded);
      const mergedSocketEvents = socketEventsFrom(
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
      if (!res.ok) throw new Error(data.error || 'Failed to save customer portal settings');
      const nextPartner = { ...emptySettings().adminPortal, ...(data.adminPortal ?? {}) };
      setSettings({ adminPortal: nextPartner });
      setSavedSettings({ adminPortal: nextPartner });
      const mergedSocketEvents = socketEventsFrom(nextPartner.adminIntegrationEndpoints);
      setSocketEvents(mergedSocketEvents);
      setSavedSocketEvents(mergedSocketEvents);
      setPartnerSaveMessage(null);
    } catch (error) {
      console.error(error);
      setPartnerSaveMessage('Failed to save customer portal settings.');
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
          adminIntegrationEndpoints: withAdminSocketState(
            settings.adminPortal.adminIntegrationEndpoints,
            socketEvents,
          ),
          partnerRealtimeSocketUrl: settings.adminPortal.partnerRealtimeSocketUrl,
          partnerSocketAuthValidator: settings.adminPortal.partnerSocketAuthValidator,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save realtime settings');
      const merged = socketEventsFrom(data.adminPortal?.adminIntegrationEndpoints);
      setSocketEvents(merged);
      setSavedSocketEvents(merged);
      setSettings((prev) => ({
        adminPortal: {
          ...prev.adminPortal,
          ...data.adminPortal,
          adminIntegrationEndpoints: merged,
        },
      }));
      setSavedSettings((prev) => ({
        adminPortal: {
          ...prev.adminPortal,
          ...data.adminPortal,
          adminIntegrationEndpoints: merged,
        },
      }));
      setSocketSaveMessage(null);
    } catch (error) {
      console.error(error);
      setSocketSaveMessage('Failed to save realtime settings.');
    } finally {
      setSavingSocketEvents(false);
    }
  }

  async function persistTogglePatch(
    patch: Partial<AdminPortalSettings>,
    message: string,
    scope: 'portal' | 'socket' = 'portal',
  ): Promise<boolean> {
    if (scope === 'socket') {
      setSavingSocketEvents(true);
      setSocketSaveMessage(null);
    } else {
      setSavingPartner(true);
      setPartnerSaveMessage(null);
    }

    try {
      const res = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'adminPortal', ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update integration toggle');

      const savedPartner = { ...emptySettings().adminPortal, ...(data.adminPortal ?? {}) };
      setSettings((prev) => ({
        adminPortal: {
          ...prev.adminPortal,
          ...(patch.enabled !== undefined ? { enabled: savedPartner.enabled } : {}),
          ...(patch.partnerSidebarEnabled !== undefined
            ? { partnerSidebarEnabled: savedPartner.partnerSidebarEnabled }
            : {}),
          ...(patch.adminIntegrationEndpoints !== undefined
            ? { adminIntegrationEndpoints: savedPartner.adminIntegrationEndpoints }
            : {}),
        },
      }));
      setSavedSettings({ adminPortal: savedPartner });

      if (patch.adminIntegrationEndpoints !== undefined) {
        const merged = socketEventsFrom(savedPartner.adminIntegrationEndpoints);
        setSocketEvents(merged);
        setSavedSocketEvents(merged);
      }

      if (scope === 'socket') setSocketSaveMessage(message || null);
      else setPartnerSaveMessage(message || null);
      return true;
    } catch (error) {
      console.error(error);
      if (scope === 'socket') setSocketSaveMessage('Failed to update realtime toggle.');
      else setPartnerSaveMessage('Failed to update integration toggle.');
      return false;
    } finally {
      if (scope === 'socket') setSavingSocketEvents(false);
      else setSavingPartner(false);
    }
  }

  async function applyToggleConfirm() {
    if (!toggleConfirm) return;
    if (toggleConfirm.kind === 'portal') {
      const next = toggleConfirm.next;
      setToggleConfirm(null);
      await handlePortalToggle(next);
      return;
    }
    if (toggleConfirm.kind === 'event') {
      const events = toggleConfirm.events;
      setToggleConfirm(null);
      if (events) setSocketEvents(events);
      return;
    }
    if (toggleConfirm.kind === 'socket') {
      const events = toggleConfirm.events;
      setToggleConfirm(null);
      if (events) await handleSocketToggle(events);
      return;
    }
    const enabled = toggleConfirm.next;
    const previousPartner = settings.adminPortal;
    const previousEvents = socketEvents;
    const nextEndpoints = (settings.adminPortal.adminIntegrationEndpoints ?? []).map((entry) => ({
      ...entry,
      adminEnabled: enabled,
    }));
    const nextEvents = socketEvents.map((event) => ({ ...event, enabled }));
    setSettings((prev) => ({
      adminPortal: {
        ...prev.adminPortal,
        enabled,
        partnerSidebarEnabled: enabled,
        adminIntegrationEndpoints: nextEndpoints,
      },
    }));
    setSocketEvents(nextEvents);
    setToggleConfirm(null);

    const saved = await persistTogglePatch(
      {
        enabled,
        partnerSidebarEnabled: enabled,
        adminIntegrationEndpoints: nextEndpoints,
      },
      '',
    );
    if (!saved) {
      setSettings({ adminPortal: previousPartner });
      setSocketEvents(previousEvents);
    }
  }

  async function handlePortalToggle(enabled: boolean) {
    const previous = settings.adminPortal;
    const nextEndpoints = (settings.adminPortal.adminIntegrationEndpoints ?? []).map((entry) =>
      entry.kind === 'http' ? { ...entry, adminEnabled: enabled } : entry,
    );
    setSettings((prev) => ({
      adminPortal: {
        ...prev.adminPortal,
        partnerSidebarEnabled: enabled,
        adminIntegrationEndpoints: nextEndpoints,
      },
    }));
    const saved = await persistTogglePatch(
      { partnerSidebarEnabled: enabled, adminIntegrationEndpoints: nextEndpoints },
      '',
    );
    if (!saved) {
      setSettings({ adminPortal: previous });
    }
  }

  async function handleSocketToggle(nextEvents: PartnerSocketEvent[]) {
    const previous = socketEvents;
    setSocketEvents(nextEvents);
    const nextEndpoints = withAdminSocketState(
      settings.adminPortal.adminIntegrationEndpoints,
      nextEvents,
    );
    const saved = await persistTogglePatch(
      { adminIntegrationEndpoints: nextEndpoints },
      '',
      'socket',
    );
    if (!saved) setSocketEvents(previous);
  }

  const partner = settings.adminPortal;
  const handoffReady =
    partner.enabled &&
    partner.referralEnabled &&
    partner.partnerSidebarEnabled &&
    partner.adminPortalUrl?.trim() &&
    partner.partnerPortalSsoSecret?.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Plug className="h-6 w-6" />
          Customer Portal
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the Support Panel handoff and realtime events.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Main control for every integration on this page.</CardDescription>
              </div>
              <Switch
                aria-label="Enable integrations"
                checked={partner.enabled}
                disabled={savingPartner}
                onCheckedChange={(checked) =>
                  setToggleConfirm({ kind: 'main', next: checked })
                }
              />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Turning this off also turns off the customer portal and realtime child integrations.
              </p>
            </CardContent>
          </Card>

          <Card className="ml-4 border-l-4 sm:ml-8">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Customer portal integration</CardTitle>
                <CardDescription>Child integration for Support Panel handoff.</CardDescription>
              </div>
              <Switch
                aria-label="Enable customer portal integration"
                checked={partner.enabled && partner.partnerSidebarEnabled}
                disabled={!partner.enabled || savingPartner}
                onCheckedChange={(checked) =>
                  setToggleConfirm({ kind: 'portal', next: checked })
                }
              />
            </CardHeader>
            <CardContent
              className={`space-y-4 ${
                !partner.enabled || !partner.partnerSidebarEnabled ? 'opacity-60' : ''
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4 text-sm">
                <span className="text-muted-foreground">Referral app integration:</span>
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
                  {handoffReady ? 'Ready' : 'Not ready'}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-portal-url">Admin portal URL</Label>
                <Input
                  id="admin-portal-url"
                  placeholder="https://admin.example.com"
                  value={partner.adminPortalUrl}
                  disabled={!partner.enabled || !partner.partnerSidebarEnabled}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      adminPortal: { ...prev.adminPortal, adminPortalUrl: event.target.value },
                    }))
                  }
                />
              </div>

              <SecretInput
                id="partner-api-key"
                label="Secret key"
                value={partner.partnerPortalSsoSecret}
                disabled={!partner.enabled || !partner.partnerSidebarEnabled}
                onChange={(value) =>
                  setSettings((prev) => ({
                    adminPortal: { ...prev.adminPortal, partnerPortalSsoSecret: value },
                  }))
                }
                helperText="Customer portal shared secret (handoff + realtime socket auth). Separate from server/internal validation keys."
              />
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!partner.enabled || !partner.partnerSidebarEnabled}
                  onClick={() =>
                    setSettings((prev) => ({
                      adminPortal: {
                        ...prev.adminPortal,
                        partnerPortalSsoSecret: randomSecretKey(),
                      },
                    }))
                  }
                >
                  Generate new secret
                </Button>
              </div>

              <SaveFooter
                dirty={partnerDirty}
                saving={savingPartner}
                message={partnerSaveMessage}
                onSave={handleSavePartner}
                saveLabel="Save customer portal settings"
              />
            </CardContent>
          </Card>

          <PartnerSocketEventsPanel
            events={socketEvents}
            saving={savingSocketEvents}
            dirty={socketEventsDirty}
            onSave={() => void handleSaveSocketEvents()}
            adminPortalUrl={partner.adminPortalUrl}
            partnerRealtimeSocketUrl={settings.adminPortal.partnerRealtimeSocketUrl}
            enabled={socketEvents.some((event) => event.enabled)}
            parentEnabled={partner.enabled}
            onEnabledChange={(enabled) =>
              setToggleConfirm({
                kind: 'socket',
                next: enabled,
                events: socketEvents.map((event) => ({ ...event, enabled })),
              })
            }
            onEventsChange={(events) => {
              const changed = events.find(
                (event) => socketEvents.find((current) => current.id === event.id)?.enabled !== event.enabled,
              );
              setToggleConfirm({
                kind: 'event',
                next: changed?.enabled ?? false,
                events,
              });
            }}
            onPartnerRealtimeSocketUrlChange={(value) =>
              setSettings((prev) => ({
                adminPortal: { ...prev.adminPortal, partnerRealtimeSocketUrl: value },
              }))
            }
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
            <AlertDialogTitle>
              {toggleConfirm?.next ? 'Enable this integration?' : 'Disable this integration?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.kind === 'main'
                ? 'This updates the main integration and every child operation.'
                : toggleConfirm?.kind === 'event'
                  ? 'Confirm the event change, then use Save socket connection to apply it.'
                : 'This change will be saved to the database immediately.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyToggleConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
