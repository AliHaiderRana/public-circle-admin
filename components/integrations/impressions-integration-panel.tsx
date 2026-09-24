'use client';

import { useMemo } from 'react';
import { ChartLine, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { SecretInput } from '@/components/integrations/secret-input';
import {
  DEFAULT_IMPRESSIONS_PANEL_DESCRIPTION,
  DEFAULT_IMPRESSIONS_PANEL_TITLE,
} from '@/lib/impressions-panel.constants';

export type ImpressionsSettings = {
  enabled: boolean;
  serverBaseUrl: string;
  internalApiKey: string;
  panelTitle: string;
  panelDescription: string;
};

export function emptyImpressionsSettings(): ImpressionsSettings {
  return {
    enabled: false,
    serverBaseUrl: '',
    internalApiKey: '',
    panelTitle: DEFAULT_IMPRESSIONS_PANEL_TITLE,
    panelDescription: DEFAULT_IMPRESSIONS_PANEL_DESCRIPTION,
  };
}

export function randomInternalApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isImpressionsDirty(current: ImpressionsSettings, saved: ImpressionsSettings): boolean {
  return (
    current.enabled !== saved.enabled ||
    current.serverBaseUrl.trim().replace(/\/$/, '') !==
      saved.serverBaseUrl.trim().replace(/\/$/, '') ||
    current.internalApiKey !== saved.internalApiKey ||
    (current.panelTitle || '').trim() !== (saved.panelTitle || '').trim() ||
    (current.panelDescription || '').trim() !== (saved.panelDescription || '').trim()
  );
}

type ImpressionsIntegrationPanelProps = {
  settings: ImpressionsSettings;
  savedSettings: ImpressionsSettings;
  saving: boolean;
  message: string | null;
  onChange: (next: ImpressionsSettings) => void;
  onSave: () => void;
  onToggle: (enabled: boolean) => void;
};

export function ImpressionsIntegrationPanel({
  settings,
  savedSettings,
  saving,
  message,
  onChange,
  onSave,
  onToggle,
}: ImpressionsIntegrationPanelProps) {
  const dirty = useMemo(
    () => isImpressionsDirty(settings, savedSettings),
    [settings, savedSettings],
  );

  const displayTitle = settings.panelTitle?.trim() || DEFAULT_IMPRESSIONS_PANEL_TITLE;
  const displayDescription =
    settings.panelDescription?.trim() || DEFAULT_IMPRESSIONS_PANEL_DESCRIPTION;

  const ready =
    settings.enabled &&
    Boolean(settings.serverBaseUrl?.trim()) &&
    Boolean(settings.internalApiKey?.trim());

  const statusText =
    message && !dirty
      ? message
      : dirty
        ? 'Unsaved changes — save to apply.'
        : 'No pending changes.';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b pb-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <ChartLine className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl font-bold">{displayTitle}</CardTitle>
            <Badge
              variant={ready ? 'default' : 'secondary'}
              className={
                ready
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : undefined
              }
            >
              {ready ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <CardDescription>{displayDescription}</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {settings.enabled ? 'On' : 'Off'}
          </span>
          <Switch
            aria-label={`Enable ${displayTitle} tracking`}
            checked={Boolean(settings.enabled)}
            disabled={saving}
            onCheckedChange={(checked) => onToggle(Boolean(checked))}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
        <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
            White-label copy
          </p>
          <div className="space-y-2">
            <Label htmlFor="impressions-panel-title">Panel / sidebar title</Label>
            <Input
              id="impressions-panel-title"
              value={settings.panelTitle || ''}
              disabled={saving}
              placeholder={DEFAULT_IMPRESSIONS_PANEL_TITLE}
              onChange={(event) =>
                onChange({ ...settings, panelTitle: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="impressions-panel-description">Description</Label>
            <Textarea
              id="impressions-panel-description"
              value={settings.panelDescription || ''}
              disabled={saving}
              rows={3}
              placeholder={DEFAULT_IMPRESSIONS_PANEL_DESCRIPTION}
              onChange={(event) =>
                onChange({ ...settings, panelDescription: event.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Used in Admin sidebar, this page, and synced to Referral Integrations. Leave blank
              to restore defaults.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="impressions-server-base-url">API base URL</Label>
          <Input
            id="impressions-server-base-url"
            placeholder="https://api.example.com"
            value={settings.serverBaseUrl}
            disabled={saving}
            onChange={(event) =>
              onChange({ ...settings, serverBaseUrl: event.target.value })
            }
          />
          <p className="text-sm text-muted-foreground">
            API server origin. Referral calls{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              /internal/referral/impressions
            </code>{' '}
            on this host.
          </p>
        </div>

        <SecretInput
          id="impressions-api-key"
          label="Internal API key"
          value={settings.internalApiKey}
          disabled={saving}
          placeholder="Generate or paste a key"
          onChange={(value) => onChange({ ...settings, internalApiKey: value })}
          helperText={`Sent as X-Internal-API-Key. Synced to Referral companies on save (Integrations → ${displayTitle}).`}
        />

        <div className="flex justify-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() =>
              onChange({ ...settings, internalApiKey: randomInternalApiKey() })
            }
          >
            Generate new key
          </Button>
        </div>

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
            Save {displayTitle.toLowerCase()} settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
