'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChartLine, Loader2 } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  ImpressionsIntegrationPanel,
  emptyImpressionsSettings,
  type ImpressionsSettings,
} from '@/components/integrations/impressions-integration-panel';
import { DEFAULT_IMPRESSIONS_PANEL_TITLE } from '@/lib/integration-settings.service';

export default function ImpressionsIntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<ImpressionsSettings>(emptyImpressionsSettings());
  const [savedSettings, setSavedSettings] = useState<ImpressionsSettings>(
    emptyImpressionsSettings(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);

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

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load impressions settings');
      const loaded = {
        ...emptyImpressionsSettings(),
        ...(data.publicCircleServer ?? {}),
      };
      setSettings(loaded);
      setSavedSettings(loaded);
    } catch (error) {
      console.error(error);
      setMessage('Failed to load impressions settings.');
    } finally {
      setLoading(false);
    }
  }

  async function persist(next: ImpressionsSettings, successMessage: string): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'publicCircleServer',
          publicCircleServer: {
            enabled: next.enabled,
            serverBaseUrl: next.serverBaseUrl.trim().replace(/\/$/, ''),
            internalApiKey: next.internalApiKey.trim(),
            panelTitle: next.panelTitle.trim() || DEFAULT_IMPRESSIONS_PANEL_TITLE,
            panelDescription:
              next.panelDescription.trim() || emptyImpressionsSettings().panelDescription,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save impressions settings');
      const saved = {
        ...emptyImpressionsSettings(),
        ...(data.publicCircleServer ?? {}),
      };
      setSettings(saved);
      setSavedSettings(saved);
      setMessage(successMessage);
      return true;
    } catch (error) {
      console.error(error);
      setMessage('Failed to save impressions settings.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const url = settings.serverBaseUrl.trim();
    if (url) {
      try {
        // eslint-disable-next-line no-new
        new URL(url);
      } catch {
        setMessage('Failed to save — enter a valid API base URL.');
        return;
      }
    }
    if (settings.enabled && (!url || !settings.internalApiKey.trim())) {
      setMessage('Failed to save — URL and API key are required when enabled.');
      return;
    }
    const title = settings.panelTitle?.trim() || DEFAULT_IMPRESSIONS_PANEL_TITLE;
    await persist(settings, `${title} settings saved.`);
  }

  async function handleToggle(enabled: boolean) {
    if (enabled && (!settings.serverBaseUrl.trim() || !settings.internalApiKey.trim())) {
      setMessage('Failed — save API base URL and key before enabling.');
      return;
    }
    setPendingToggle(enabled);
  }

  async function applyToggle() {
    if (pendingToggle === null) return;
    const enabled = pendingToggle;
    setPendingToggle(null);
    const previous = settings;
    const next = { ...settings, enabled };
    setSettings(next);
    const title = settings.panelTitle?.trim() || DEFAULT_IMPRESSIONS_PANEL_TITLE;
    const ok = await persist(
      next,
      enabled ? `${title} tracking enabled.` : `${title} tracking disabled.`,
    );
    if (!ok) setSettings(previous);
  }

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pageTitle = settings.panelTitle?.trim() || DEFAULT_IMPRESSIONS_PANEL_TITLE;
  const pageDescription =
    settings.panelDescription?.trim() ||
    'Authenticate Referral reporting against email outreach. Super-admin only.';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ChartLine className="h-6 w-6" />
          {pageTitle}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <ImpressionsIntegrationPanel
          settings={settings}
          savedSettings={savedSettings}
          saving={saving}
          message={message}
          onChange={setSettings}
          onSave={() => void handleSave()}
          onToggle={(enabled) => void handleToggle(enabled)}
        />
      )}

      <AlertDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggle
                ? `Enable ${pageTitle.toLowerCase()} tracking?`
                : `Disable ${pageTitle.toLowerCase()} tracking?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This updates the internal API key used for Referral authentication immediately when
              you continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyToggle()}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
