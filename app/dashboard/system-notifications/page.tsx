'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Bell, Mail, Shield, Users } from 'lucide-react';
import { SupportQuickLinks } from '@/components/SupportQuickLinks';
import {
  ConfirmToggleDialog,
  type ConfirmToggleRequest,
} from '@/components/ConfirmToggleDialog';
import {
  computeTeamRecipients,
  type AdminRecipient,
  type TeamRecipient,
  type SystemNotificationSettings,
} from '@/lib/system-notifications';

type SettingsState = SystemNotificationSettings & {
  adminRecipients: AdminRecipient[];
};

type PendingToggle = ConfirmToggleRequest & {
  apply: () => Promise<void>;
};

export default function SystemNotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle | null>(null);
  const [toggleSaving, setToggleSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const applyPayload = useCallback((data: SettingsState) => {
    setSettings(data);
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system-notifications');
      if (!res.ok) return;
      const data = await res.json();
      applyPayload(data);
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchSettings();
    }
  }, [user, fetchSettings]);

  const patchSettings = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/system-notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error('Failed to update notification settings');
    }

    const data = await res.json();
    applyPayload(data);
    return data;
  };

  const requestToggle = (request: Omit<PendingToggle, 'apply'> & { apply: () => Promise<void> }) => {
    setPendingToggle(request);
  };

  const confirmToggle = async () => {
    if (!pendingToggle) return;
    setToggleSaving(true);
    try {
      await pendingToggle.apply();
      setFeedback({ type: 'success', text: 'Notification settings updated' });
      setPendingToggle(null);
    } catch {
      setFeedback({ type: 'error', text: 'Failed to update notification settings' });
    } finally {
      setToggleSaving(false);
    }
  };

  const requestBooleanToggle = ({
    title,
    description,
    nextValue,
    patchBody,
  }: {
    title: string;
    description: string;
    nextValue: boolean;
    patchBody: Record<string, unknown>;
  }) => {
    requestToggle({
      title,
      description,
      confirmLabel: nextValue ? 'Turn on' : 'Turn off',
      apply: () => patchSettings(patchBody),
    });
  };

  const teamRecipients = useMemo(() => {
    if (!settings) return [];
    return computeTeamRecipients({
      supportSendAlertEmail: settings.supportSendAlertEmail,
      adminRecipients: settings.adminRecipients,
    });
  }, [settings]);

  const superAdmins = settings?.adminRecipients.filter((admin) => admin.isSuperAdmin) ?? [];
  const regularAdmins = settings?.adminRecipients.filter((admin) => !admin.isSuperAdmin) ?? [];

  const ToggleRow = ({
    id,
    label,
    description,
    checked,
    onRequestChange,
    disabled = false,
  }: {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onRequestChange: (nextValue: boolean) => void;
    disabled?: boolean;
  }) => (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium leading-none">
          {label}
        </Label>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={() => onRequestChange(!checked)}
        disabled={disabled || toggleSaving}
      />
    </div>
  );

  const RecipientList = ({ recipients }: { recipients: TeamRecipient[] }) => (
    <div className="rounded-lg border bg-neutral-50 dark:bg-neutral-900/40 divide-y">
      {recipients.length === 0 ? (
        <p className="p-4 text-sm text-neutral-500">No alert email recipients selected.</p>
      ) : (
        recipients.map((row) => (
          <div
            key={`${row.source}-${row.email}`}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <span className="font-medium">{row.email}</span>
            <Badge variant="outline" className="font-normal shrink-0">
              {row.source}
            </Badge>
          </div>
        ))
      )}
    </div>
  );

  const AdminGroupTable = ({
    title,
    icon,
    admins,
    roleDescription,
    globalAlertEnabled,
  }: {
    title: string;
    icon: React.ReactNode;
    admins: AdminRecipient[];
    roleDescription: string;
    globalAlertEnabled: boolean;
  }) => (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold">{title}</p>
          <Badge variant="secondary">{admins.length}</Badge>
        </div>
        <p className="text-sm text-neutral-500">{roleDescription}</p>
      </div>

      {admins.length === 0 ? (
        <p className="text-sm text-neutral-500">No admin users in this group.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[140px] text-center">Alert emails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell>
                  <p className="font-medium">{admin.name || admin.email}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-neutral-600">{admin.email}</p>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={admin.notifySupportAlertEmail}
                    onCheckedChange={() =>
                      requestBooleanToggle({
                        title: admin.notifySupportAlertEmail
                          ? `Stop alert emails for ${admin.email}?`
                          : `Send alert emails to ${admin.email}?`,
                        description: admin.notifySupportAlertEmail
                          ? `${admin.email} will no longer receive support alert emails.`
                          : `${admin.email} will receive short support alert emails when requests are submitted.`,
                        nextValue: !admin.notifySupportAlertEmail,
                        patchBody: {
                          adminPreferences: [
                            {
                              adminId: admin.id,
                              notifySupportAlertEmail: !admin.notifySupportAlertEmail,
                            },
                          ],
                        },
                      })
                    }
                    disabled={toggleSaving || !globalAlertEnabled}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  const teamEmailsActive = settings?.supportSendAlertEmail && teamRecipients.length > 0;

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">System Notifications</h2>
        <p className="text-neutral-500">
          Super admins choose which admin emails receive support alert emails. In-app bell
          notifications are not configured here.
        </p>
      </div>

      <SupportQuickLinks />

      {feedback && (
        <p
          className={
            feedback.type === 'success'
              ? 'rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800'
              : 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
          }
        >
          {feedback.text}
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Support email notifications</CardTitle>
          </div>
          <CardDescription>
            Alert emails go directly to selected admin addresses when a support request is
            submitted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading || !settings ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-sm font-medium">Email types</p>
                <ToggleRow
                  id="supportSendAlertEmail"
                  label="Alert email"
                  description="Short notification sent to selected admins when a support request is submitted."
                  checked={settings.supportSendAlertEmail}
                  onRequestChange={(nextValue) =>
                    requestBooleanToggle({
                      title: nextValue ? 'Enable alert emails?' : 'Disable alert emails?',
                      description: nextValue
                        ? 'Selected admins can receive short support alert emails.'
                        : 'Support alert emails will stop being sent.',
                      nextValue,
                      patchBody: { supportSendAlertEmail: nextValue },
                    })
                  }
                />
              </div>

              <div className="space-y-4 pt-2 border-t">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Admin alert recipients</p>
                  <p className="text-xs text-neutral-500">
                    Turn alert emails on or off for each admin individually. Toggles are disabled
                    when alert emails are turned off globally.
                  </p>
                </div>
                <AdminGroupTable
                  title="Super admins"
                  icon={<Shield className="h-4 w-4 text-amber-600" />}
                  admins={superAdmins}
                  roleDescription="Choose which super admins receive support alert emails."
                  globalAlertEnabled={settings.supportSendAlertEmail}
                />
                <AdminGroupTable
                  title="Admins"
                  icon={<Users className="h-4 w-4 text-blue-600" />}
                  admins={regularAdmins}
                  roleDescription="Choose which admins receive support alert emails."
                  globalAlertEnabled={settings.supportSendAlertEmail}
                />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-neutral-500" />
                  <p className="text-sm font-medium">Alert email recipients</p>
                </div>
                <p className="text-xs text-neutral-500">
                  {teamEmailsActive
                    ? 'These addresses will receive alert emails when support requests are submitted.'
                    : 'Enable alert emails globally and turn them on for at least one admin.'}
                </p>
                <RecipientList recipients={teamRecipients} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmToggleDialog
        request={pendingToggle}
        saving={toggleSaving}
        onConfirm={confirmToggle}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
}
