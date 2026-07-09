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
  adminIntegrationEndpoints?: PartnerSocketEvent[];
};

type IntegrationSettings = {
  adminPortal: AdminPortalSettings;
};

type ToggleConfirm = { next: boolean };

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

function isPartnerPortalDirty(current: AdminPortalSettings, saved: AdminPortalSettings): boolean {
  return (
    current.enabled !== saved.enabled ||
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
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {saveLabel}
      </button>
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
      const mergedSocketEvents = mergePartnerSocketEvents(nextPartner.adminIntegrationEndpoints);
      setSocketEvents(mergedSocketEvents);
      setSavedSocketEvents(mergedSocketEvents);
      setPartnerSaveMessage('Customer portal settings saved.');
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
          adminIntegrationEndpoints: socketEvents,
          partnerRealtimeSocketUrl: settings.adminPortal.partnerRealtimeSocketUrl,
          partnerSocketAuthValidator: settings.adminPortal.partnerSocketAuthValidator,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save realtime settings');
      const merged = mergePartnerSocketEvents(data.adminPortal?.adminIntegrationEndpoints);
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
      setSocketSaveMessage('Realtime settings saved.');
    } catch (error) {
      console.error(error);
      setSocketSaveMessage('Failed to save realtime settings.');
    } finally {
      setSavingSocketEvents(false);
    }
  }

  function applyToggleConfirm() {
    if (!toggleConfirm) return;
    setSettings((prev) => ({
      adminPortal: { ...prev.adminPortal, enabled: toggleConfirm.next },
    }));
    setToggleConfirm(null);
  }

  const partner = settings.adminPortal;
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
          Customer portal settings and realtime events.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Customer portal integration</CardTitle>
              <CardDescription>
                Keep this page focused on handoff + realtime only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="partner-enabled">Enable customer portal integration (admin)</Label>
                  <p className="text-sm text-muted-foreground">
                    Accept Support Panel handoff from referral app.
                  </p>
                </div>
                <Switch
                  id="partner-enabled"
                  checked={partner.enabled}
                  onCheckedChange={(checked) => setToggleConfirm({ next: checked })}
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
                      adminPortal: { ...prev.adminPortal, adminPortalUrl: event.target.value },
                    }))
                  }
                />
              </div>

              <SecretInput
                id="partner-api-key"
                label="Secret key"
                value={partner.partnerPortalSsoSecret}
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
              {toggleConfirm?.next
                ? 'Enable customer portal integration (admin)?'
                : 'Disable customer portal integration (admin)?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleConfirm?.next
                ? 'Referral users can access Support Panel after save.'
                : 'New Support Panel handoffs will be blocked after save.'}
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
