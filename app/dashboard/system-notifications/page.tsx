'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bell, Mail } from 'lucide-react';
import { SupportQuickLinks } from '@/components/SupportQuickLinks';
import {
  computeTeamRecipients,
  type AdminRecipient,
  type TeamRecipient,
} from '@/lib/system-notifications';

export default function SystemNotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [supportNotificationEmail, setSupportNotificationEmail] = useState('');
  const [supportSendAlertEmail, setSupportSendAlertEmail] = useState(true);
  const [supportSendDetailEmail, setSupportSendDetailEmail] = useState(true);
  const [supportSendCustomerConfirmation, setSupportSendCustomerConfirmation] = useState(true);
  const [supportNotifySuperAdmins, setSupportNotifySuperAdmins] = useState(true);
  const [supportNotifyAdmins, setSupportNotifyAdmins] = useState(true);
  const [adminRecipients, setAdminRecipients] = useState<AdminRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchSettings();
    }
  }, [user]);

  const teamRecipients = useMemo(
    () =>
      computeTeamRecipients({
        supportNotificationEmail: supportNotificationEmail.trim() || null,
        supportNotifySuperAdmins,
        supportNotifyAdmins,
        adminRecipients,
      }),
    [
      supportNotificationEmail,
      supportNotifySuperAdmins,
      supportNotifyAdmins,
      adminRecipients,
    ],
  );

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system-notifications');
      if (!res.ok) return;
      const data = await res.json();
      setSupportNotificationEmail(data.supportNotificationEmail ?? '');
      setSupportSendAlertEmail(data.supportSendAlertEmail ?? true);
      setSupportSendDetailEmail(data.supportSendDetailEmail ?? true);
      setSupportSendCustomerConfirmation(data.supportSendCustomerConfirmation ?? true);
      setSupportNotifySuperAdmins(data.supportNotifySuperAdmins ?? true);
      setSupportNotifyAdmins(data.supportNotifyAdmins ?? true);
      setAdminRecipients(data.adminRecipients ?? []);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/system-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supportNotificationEmail:
            supportNotificationEmail.trim() === '' ? null : supportNotificationEmail.trim(),
          supportSendAlertEmail,
          supportSendDetailEmail,
          supportSendCustomerConfirmation,
          supportNotifySuperAdmins,
          supportNotifyAdmins,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSupportNotificationEmail(data.supportNotificationEmail ?? '');
        setSupportSendAlertEmail(data.supportSendAlertEmail ?? true);
        setSupportSendDetailEmail(data.supportSendDetailEmail ?? true);
        setSupportSendCustomerConfirmation(data.supportSendCustomerConfirmation ?? true);
        setSupportNotifySuperAdmins(data.supportNotifySuperAdmins ?? true);
        setSupportNotifyAdmins(data.supportNotifyAdmins ?? true);
        setAdminRecipients(data.adminRecipients ?? []);
      }
    } finally {
      setUpdating(false);
    }
  };

  const ToggleRow = ({
    id,
    label,
    description,
    checked,
    onCheckedChange,
  }: {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
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
        onCheckedChange={onCheckedChange}
        disabled={updating}
      />
    </div>
  );

  const RecipientList = ({ recipients }: { recipients: TeamRecipient[] }) => (
    <div className="rounded-lg border bg-neutral-50 dark:bg-neutral-900/40 divide-y">
      {recipients.length === 0 ? (
        <p className="p-4 text-sm text-neutral-500">
          No team recipients selected. Add a support email above or enable admin notifications.
          If nothing is configured, the server uses SUPPORT_EMAIL from the environment.
        </p>
      ) : (
        recipients.map((row) => (
          <div
            key={row.email}
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

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  const teamEmailsActive =
    (supportSendAlertEmail || supportSendDetailEmail) && teamRecipients.length > 0;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Notifications</h2>
          <p className="text-neutral-500">
            One support inbox plus optional admin panel users. Preview who receives team emails
            below.
          </p>
        </div>
      </div>

      <SupportQuickLinks />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Support notifications</CardTitle>
          </div>
          <CardDescription>
            Configure one support email and which notification types are sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="supportNotificationEmail">Support email</Label>
                <Input
                  id="supportNotificationEmail"
                  type="email"
                  value={supportNotificationEmail}
                  onChange={(e) => setSupportNotificationEmail(e.target.value)}
                  placeholder="support@yourcompany.com"
                  disabled={updating}
                />
                <p className="text-xs text-neutral-500">
                  Primary inbox for alert and detail emails when a support request is submitted.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Email types</p>
                <ToggleRow
                  id="supportSendAlertEmail"
                  label="Alert email"
                  description="Short notification to your team."
                  checked={supportSendAlertEmail}
                  onCheckedChange={setSupportSendAlertEmail}
                />
                <ToggleRow
                  id="supportSendDetailEmail"
                  label="Detail email"
                  description="Full request content including the customer message."
                  checked={supportSendDetailEmail}
                  onCheckedChange={setSupportSendDetailEmail}
                />
                <ToggleRow
                  id="supportSendCustomerConfirmation"
                  label="Customer confirmation"
                  description="Sent to the customer who submitted the request (not listed below)."
                  checked={supportSendCustomerConfirmation}
                  onCheckedChange={setSupportSendCustomerConfirmation}
                />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <p className="text-sm font-medium">Also notify admin panel users</p>
                <ToggleRow
                  id="supportNotifySuperAdmins"
                  label="Super admins"
                  description="Include super admin account emails from Admin Users."
                  checked={supportNotifySuperAdmins}
                  onCheckedChange={setSupportNotifySuperAdmins}
                />
                <ToggleRow
                  id="supportNotifyAdmins"
                  label="Admins"
                  description="Include regular admin account emails from Admin Users."
                  checked={supportNotifyAdmins}
                  onCheckedChange={setSupportNotifyAdmins}
                />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-neutral-500" />
                  <p className="text-sm font-medium">Emails that will receive team notifications</p>
                </div>
                <p className="text-xs text-neutral-500">
                  {teamEmailsActive
                    ? 'Alert and detail emails are sent to each address below.'
                    : 'Enable alert or detail email and add at least one recipient.'}
                </p>
                <RecipientList recipients={teamRecipients} />
              </div>

              <div className="flex items-center justify-end">
                <Button onClick={handleSave} disabled={updating}>
                  {updating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
