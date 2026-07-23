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
import { Loader2, Bell, CheckCircle2, Database, Mail, MailWarning, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ConfirmToggleDialog,
  type ConfirmToggleRequest,
} from '@/components/ConfirmToggleDialog';
import {
  computeSupportRecipients,
  computeDlqRecipients,
  computeDbRecipients,
  type AdminRecipient,
  type TeamRecipient,
  type SystemNotificationSettings,
} from '@/lib/system-notifications';

type SettingsState = SystemNotificationSettings & {
  adminRecipients: AdminRecipient[];
  supportRecipients: TeamRecipient[];
  dlqRecipients: TeamRecipient[];
  dbRecipients: TeamRecipient[];
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

  const supportRecipients = useMemo(() => {
    if (!settings) return [];
    return computeSupportRecipients({
      supportSendAlertEmail: settings.supportSendAlertEmail,
      adminRecipients: settings.adminRecipients,
    });
  }, [settings]);

  const dlqRecipients = useMemo(() => {
    if (!settings) return [];
    return computeDlqRecipients({
      dlqSendAlertEmail: settings.dlqSendAlertEmail,
      adminRecipients: settings.adminRecipients,
    });
  }, [settings]);

  const dbRecipients = useMemo(() => {
    if (!settings) return [];
    return computeDbRecipients({
      dbSendAlertEmail: settings.dbSendAlertEmail,
      adminRecipients: settings.adminRecipients,
    });
  }, [settings]);

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
        <p className="text-sm text-muted-foreground">{description}</p>
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
        <p className="p-4 text-sm text-muted-foreground">No alert email recipients selected.</p>
      ) : (
        recipients.map((row) => (
          <div
            key={`${row.source}-${row.email}`}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <span className="font-medium min-w-0 flex-1 truncate" title={row.email}>
              {row.email}
            </span>
            <Badge variant="outline" className="font-normal shrink-0">
              {row.source}
            </Badge>
          </div>
        ))
      )}
    </div>
  );

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">System Notifications</h2>
        <p className="text-muted-foreground">
          Super admins control which alert emails are sent and which admin users receive them.
          In-app bell notifications are not configured here.
        </p>
      </div>

      {feedback && (
        <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Email alert types</CardTitle>
          </div>
          <CardDescription>
            Turn each alert type on or off globally. Per-admin delivery is configured in the
            table below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading || !settings ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <>
              <ToggleRow
                id="supportSendAlertEmail"
                label="Support request alerts"
                description="Short notification when a customer submits a support request."
                checked={settings.supportSendAlertEmail}
                onRequestChange={(nextValue) =>
                  requestBooleanToggle({
                    title: nextValue ? 'Enable support alert emails?' : 'Disable support alert emails?',
                    description: nextValue
                      ? 'Selected admins can receive support alert emails.'
                      : 'Support alert emails will stop being sent.',
                    nextValue,
                    patchBody: { supportSendAlertEmail: nextValue },
                  })
                }
              />
              <ToggleRow
                id="dlqSendAlertEmail"
                label="DLQ alerts"
                description="Notification when failed outbound campaign emails land in the Dead Letter Queue."
                checked={settings.dlqSendAlertEmail}
                onRequestChange={(nextValue) =>
                  requestBooleanToggle({
                    title: nextValue ? 'Enable DLQ alert emails?' : 'Disable DLQ alert emails?',
                    description: nextValue
                      ? 'Selected admins can receive DLQ alert emails.'
                      : 'DLQ alert emails will stop being sent.',
                    nextValue,
                    patchBody: { dlqSendAlertEmail: nextValue },
                  })
                }
              />
              <ToggleRow
                id="dbSendAlertEmail"
                label="DB storage alerts"
                description="Notification once total MongoDB cluster storage crosses 4 GB. Checked daily."
                checked={settings.dbSendAlertEmail}
                onRequestChange={(nextValue) =>
                  requestBooleanToggle({
                    title: nextValue ? 'Enable DB storage alert emails?' : 'Disable DB storage alert emails?',
                    description: nextValue
                      ? 'Selected admins can receive DB storage alert emails.'
                      : 'DB storage alert emails will stop being sent.',
                    nextValue,
                    patchBody: { dbSendAlertEmail: nextValue },
                  })
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin alert recipients</CardTitle>
          <CardDescription>
            Choose which admins receive each alert type. Toggles are disabled when that alert
            type is turned off globally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !settings ? (
            <Skeleton className="h-48 w-full" />
          ) : settings.adminRecipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admin</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[120px] text-center">Support</TableHead>
                  <TableHead className="w-[120px] text-center">DLQ</TableHead>
                  <TableHead className="w-[120px] text-center">DB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.adminRecipients.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{admin.name || admin.email}</p>
                        {admin.isSuperAdmin && (
                          <Badge variant="secondary" className="font-normal">
                            Super admin
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={admin.notifySupportAlertEmail}
                        onCheckedChange={() =>
                          requestBooleanToggle({
                            title: admin.notifySupportAlertEmail
                              ? `Stop support alerts for ${admin.email}?`
                              : `Send support alerts to ${admin.email}?`,
                            description: admin.notifySupportAlertEmail
                              ? `${admin.email} will no longer receive support alert emails.`
                              : `${admin.email} will receive support alert emails.`,
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
                        disabled={toggleSaving || !settings.supportSendAlertEmail}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={admin.notifyDlqAlertEmail}
                        onCheckedChange={() =>
                          requestBooleanToggle({
                            title: admin.notifyDlqAlertEmail
                              ? `Stop DLQ alerts for ${admin.email}?`
                              : `Send DLQ alerts to ${admin.email}?`,
                            description: admin.notifyDlqAlertEmail
                              ? `${admin.email} will no longer receive DLQ alert emails.`
                              : `${admin.email} will receive DLQ alert emails.`,
                            nextValue: !admin.notifyDlqAlertEmail,
                            patchBody: {
                              adminPreferences: [
                                {
                                  adminId: admin.id,
                                  notifyDlqAlertEmail: !admin.notifyDlqAlertEmail,
                                },
                              ],
                            },
                          })
                        }
                        disabled={toggleSaving || !settings.dlqSendAlertEmail}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={admin.notifyDbAlertEmail}
                        onCheckedChange={() =>
                          requestBooleanToggle({
                            title: admin.notifyDbAlertEmail
                              ? `Stop DB storage alerts for ${admin.email}?`
                              : `Send DB storage alerts to ${admin.email}?`,
                            description: admin.notifyDbAlertEmail
                              ? `${admin.email} will no longer receive DB storage alert emails.`
                              : `${admin.email} will receive DB storage alert emails.`,
                            nextValue: !admin.notifyDbAlertEmail,
                            patchBody: {
                              adminPreferences: [
                                {
                                  adminId: admin.id,
                                  notifyDbAlertEmail: !admin.notifyDbAlertEmail,
                                },
                              ],
                            },
                          })
                        }
                        disabled={toggleSaving || !settings.dbSendAlertEmail}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Support alert recipients</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <RecipientList recipients={supportRecipients} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MailWarning className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">DLQ alert recipients</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <RecipientList recipients={dlqRecipients} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">DB alert recipients</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <RecipientList recipients={dbRecipients} />
          </CardContent>
        </Card>
      </div>

      <ConfirmToggleDialog
        request={pendingToggle}
        saving={toggleSaving}
        onConfirm={confirmToggle}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  );
}
