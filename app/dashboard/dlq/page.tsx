'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
} from 'lucide-react';
import type { DlqStatus } from '@/app/api/dlq/route';

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function emailsToTextarea(emails: string[]) {
  return emails.join('\n');
}

function parseEmailsInput(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export default function DlqPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<DlqStatus | null>(null);
  const [alertEmailsInput, setAlertEmailsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redriving, setRedriving] = useState(false);
  const [confirmRedriveOpen, setConfirmRedriveOpen] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const applyStatus = useCallback((data: DlqStatus) => {
    setStatus(data);
    setAlertEmailsInput(emailsToTextarea(data.dlqAlertEmails || []));
  }, []);

  const fetchStatus = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setMessage(null);

    try {
      const res = await fetch('/api/dlq', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to load DLQ status' });
        return;
      }

      applyStatus(data);
      setLastRefreshedAt(new Date().toISOString());
    } catch {
      setMessage({ type: 'error', text: 'Failed to load DLQ status' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchStatus();
    }
  }, [user, fetchStatus]);

  const handleSaveAlertEmails = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/dlq', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dlqAlertEmails: parseEmailsInput(alertEmailsInput),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to save alert recipients' });
        return;
      }

      applyStatus(data);
      setMessage({ type: 'success', text: 'DLQ alert recipients saved' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save alert recipients' });
    } finally {
      setSaving(false);
    }
  };

  const handleRedrive = async () => {
    setRedriving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/dlq/redrive', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to redrive DLQ messages' });
        return;
      }

      const resentCount = data.data?.resentCount ?? 0;
      setMessage({
        type: 'success',
        text: `${data.message || 'Redrive complete'} (${resentCount} message(s) moved back to SQS)`,
      });
      setConfirmRedriveOpen(false);
      await fetchStatus({ silent: true });
    } catch {
      setMessage({ type: 'error', text: 'Failed to redrive DLQ messages' });
    } finally {
      setRedriving(false);
    }
  };

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  const messageCount = status?.dlqMessageCount;
  const hasMessages = typeof messageCount === 'number' && messageCount > 0;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dead Letter Queue</h2>
          <p className="text-neutral-500">
            Monitor failed outbound campaign emails, configure alert recipients, and redrive
            messages back to SQS.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchStatus({ silent: true })} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh count
        </Button>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : message.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Queue status</CardTitle>
                <CardDescription>
                  Approximate number of failed outbound email messages currently in the DLQ.
                </CardDescription>
              </div>
              {status?.environment && <Badge variant="outline">{status.environment}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <div
                    className={`text-5xl font-bold tracking-tight ${
                      hasMessages ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {typeof messageCount === 'number' ? messageCount : '—'}
                  </div>
                  <div className="pb-2 text-sm text-neutral-500">messages in DLQ</div>
                </div>

                {status?.countError && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Could not fetch live count: {status.countError}
                  </div>
                )}

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-neutral-500">Last alert sent</div>
                    <div className="font-medium">{formatDate(status?.dlqLastAlertAt ?? null)}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-neutral-500">Count refreshed</div>
                    <div className="font-medium">{formatDate(lastRefreshedAt)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setConfirmRedriveOpen(true)}
                    disabled={!hasMessages || redriving}
                  >
                    {redriving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Redrive DLQ to SQS
                  </Button>
                </div>

                <p className="text-xs text-neutral-500">
                  Redrive moves all DLQ messages back to the main outbound queue for another
                  delivery attempt. Fix the underlying issue before redriving, or messages may
                  return to the DLQ again.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>Alert recipients</CardTitle>
            </div>
            <CardDescription>
              These addresses receive DLQ alert emails when failed messages are detected. Leave
              empty to use the default admin email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                {status?.defaultAlertEmail && (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <span className="text-neutral-500">Fallback recipient: </span>
                    <span className="font-medium">{status.defaultAlertEmail}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="dlqAlertEmails">Alert email addresses</Label>
                  <Textarea
                    id="dlqAlertEmails"
                    value={alertEmailsInput}
                    onChange={(e) => setAlertEmailsInput(e.target.value)}
                    placeholder={'ops@example.com, admin@example.com\nbilling@example.com'}
                    rows={6}
                    disabled={saving}
                  />
                  <p className="text-xs text-neutral-500">
                    Separate emails with commas or put one per line. A new alert is sent when
                    messages land in the DLQ again after a redrive, or when the DLQ count changes.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveAlertEmails} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save recipients
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle>How this works</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-neutral-600">
          <p>
            Campaign emails are sent through the outbound SQS queue. If{' '}
            <code className="rounded bg-muted px-1 py-0.5">/campaigns/sst-email</code> fails
            repeatedly, messages move to the DLQ.
          </p>
          <p>
            The <strong>Get DLQ Info</strong> cron checks every 10 minutes and sends alert emails
            when the DLQ count changes or messages return after a redrive. Use this page to
            inspect the live count, manage recipients, and manually redrive messages.
          </p>
        </CardContent>
      </Card>

      <Dialog open={confirmRedriveOpen} onOpenChange={setConfirmRedriveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redrive DLQ messages to SQS?</DialogTitle>
            <DialogDescription>
              This will move {messageCount ?? 0} message(s) from the Dead Letter Queue back to the
              main outbound queue for reprocessing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRedriveOpen(false)} disabled={redriving}>
              Cancel
            </Button>
            <Button onClick={handleRedrive} disabled={redriving}>
              {redriving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Confirm redrive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
