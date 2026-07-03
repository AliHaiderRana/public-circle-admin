'use client';

import { useEffect, useState } from 'react';
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
import { SecretInput } from '@/components/integrations/secret-input';

type AdminPortalSettings = {
  enabled: boolean;
  referralEnabled: boolean;
  adminPortalUrl: string;
  partnerPortalSsoSecret: string;
  partnerSidebarLabel: string;
  partnerSidebarEnabled: boolean;
  referralBackendApiKey: string;
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

export default function IntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<IntegrationSettings>(emptySettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);
  const [regenerateKeyConfirm, setRegenerateKeyConfirm] = useState(false);

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
      setSettings({
        adminPortal: { ...emptySettings().adminPortal, ...(data.adminPortal ?? {}) },
        publicCircleServer: {
          ...emptySettings().publicCircleServer,
          ...(data.publicCircleServer ?? {}),
        },
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save integrations');
      setSettings({
        adminPortal: { ...emptySettings().adminPortal, ...(data.adminPortal ?? {}) },
        publicCircleServer: {
          ...emptySettings().publicCircleServer,
          ...(data.publicCircleServer ?? {}),
        },
      });
      setSaveMessage('Integration settings saved. Partner access updates after save.');
    } catch (error) {
      console.error(error);
      setSaveMessage('Failed to save integration settings.');
    } finally {
      setSaving(false);
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
          Configure integration settings and review the live API reference below. Changes apply after
          you click Save integrations.
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Referral partner portal</CardTitle>
              <CardDescription>
                Admin-side handoff acceptance. Both this toggle and referral app → Integrations must
                be enabled for partners to access this portal. Sidebar settings live in the referral
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
                    Allows this admin portal to accept partner SSO from the referral app.
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
                id="partner-sso-secret"
                label="Partner SSO secret"
                value={partner.partnerPortalSsoSecret}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    adminPortal: { ...prev.adminPortal, partnerPortalSsoSecret: value },
                  }))
                }
                helperText="Shared with the referral app. Signs short-lived browser handoff tokens only — not used for server API calls."
              />

              <div className="space-y-2">
                <SecretInput
                  id="referral-backend-api-key"
                  label="Referral API integration key"
                  value={partner.referralBackendApiKey}
                  readOnly
                  helperText="Separate from SSO. Used when the referral backend calls admin for badge counts and signup sync. Auto-generated on save if empty."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRegenerateKeyConfirm(true)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate integration key
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {saveMessage ? (
              <p
                className={`text-sm ${saveMessage.includes('Failed') ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {saveMessage}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Toggle changes are not live until you save.
              </p>
            )}
            <Button onClick={handleSave} disabled={saving} className="sm:ml-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save integrations
            </Button>
          </div>

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

      <AlertDialog open={regenerateKeyConfirm} onOpenChange={setRegenerateKeyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate referral API integration key?</AlertDialogTitle>
            <AlertDialogDescription>
              The referral backend must use the new key after you save. Badge counts and signup sync
              will fail until the saved key is active on both sides.
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
                    referralBackendApiKey: randomApiKey(),
                  },
                }));
                setRegenerateKeyConfirm(false);
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
