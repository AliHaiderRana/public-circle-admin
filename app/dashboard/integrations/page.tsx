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
import { Loader2, Plug } from 'lucide-react';

type AdminPortalSettings = {
  enabled: boolean;
  adminPortalUrl: string;
  partnerPortalSsoSecret: string;
  partnerSidebarLabel: string;
  partnerSidebarEnabled: boolean;
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

const emptySettings = (): IntegrationSettings => ({
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
});

export default function IntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<IntegrationSettings>(emptySettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

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
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  const server = settings.publicCircleServer;
  const partner = settings.adminPortal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Plug className="h-6 w-6" />
          Integrations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All integration settings live in MongoDB. Support stats and tickets are read from the
          database directly — the server URL below is only for realtime sockets and legacy
          provisioning calls.
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
                Server URL and internal API key (stored in the database) are used by the referral
                backend for partner badge counts and provisioning. Admin reads support data from
                MongoDB directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="server-enabled">Enable server integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Required for referral partner badges and third-party user provisioning.
                  </p>
                </div>
                <Switch
                  id="server-enabled"
                  checked={server.enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      publicCircleServer: { ...prev.publicCircleServer, enabled: checked },
                    }))
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
              <div className="space-y-2">
                <Label htmlFor="internal-api-key">Internal API key</Label>
                <Input
                  id="internal-api-key"
                  type={showSecrets ? 'text' : 'password'}
                  value={server.internalApiKey}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      publicCircleServer: {
                        ...prev.publicCircleServer,
                        internalApiKey: event.target.value,
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Referral partner portal</CardTitle>
              <CardDescription>
                SSO handoff from the Venndii Referral App into this admin panel. Handoff URL, SSO
                secret, and sidebar label are shared with Venndii Referral App → Integrations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="partner-enabled">Enable partner handoff</Label>
                </div>
                <Switch
                  id="partner-enabled"
                  checked={partner.enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      adminPortal: { ...prev.adminPortal, enabled: checked },
                    }))
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
              <div className="space-y-2">
                <Label htmlFor="partner-sso-secret">Partner SSO secret</Label>
                <Input
                  id="partner-sso-secret"
                  type={showSecrets ? 'text' : 'password'}
                  value={partner.partnerPortalSsoSecret}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      adminPortal: {
                        ...prev.adminPortal,
                        partnerPortalSsoSecret: event.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sidebar-label">Partner sidebar label</Label>
                <Input
                  id="sidebar-label"
                  value={partner.partnerSidebarLabel}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      adminPortal: {
                        ...prev.adminPortal,
                        partnerSidebarLabel: event.target.value,
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => setShowSecrets((prev) => !prev)}>
              {showSecrets ? 'Hide secrets' : 'Show secrets'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save integrations
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
