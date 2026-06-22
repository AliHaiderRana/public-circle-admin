'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { AlertTriangle, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DlqStatus } from '@/app/api/dlq/route';

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function DlqPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<DlqStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

      setStatus(data);
      setLastRefreshedAt(new Date().toISOString());
    } catch {
      setMessage({ type: 'error', text: 'Failed to load DLQ status' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchStatus();
    }
  }, [user, fetchStatus]);

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
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dead Letter Queue</h2>
          <p className="text-neutral-500">
            Monitor failed outbound campaign emails and redrive messages back to SQS. Alert
            recipients are managed under{' '}
            <Link href="/dashboard/system-notifications" className="underline underline-offset-2">
              System Notifications
            </Link>
            .
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
          <CardTitle>Failed messages</CardTitle>
          <CardDescription>
            Peek at messages currently in the DLQ. Failure reasons are recorded when{' '}
            <code className="rounded bg-muted px-1 py-0.5">/campaigns/sst-email</code> returns an
            error.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : status?.messagesError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Could not load message details: {status.messagesError}
            </div>
          ) : !status?.messages?.length ? (
            <p className="text-sm text-neutral-500">No failed messages in the DLQ right now.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Failure reason</TableHead>
                    <TableHead>Last failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.messages.map((row) => (
                    <TableRow key={row.messageId}>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <p className="font-medium">{row.emailTo || '—'}</p>
                          {row.emailSubject && (
                            <p className="text-xs text-neutral-500">{row.emailSubject}</p>
                          )}
                          {typeof row.receiveCount === 'number' && row.receiveCount > 0 && (
                            <p className="text-xs text-neutral-500">
                              {row.receiveCount} delivery attempt(s)
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {row.companyId ? (
                          <Link
                            href={`/dashboard/companies/${row.companyId}`}
                            className="text-sm underline underline-offset-2"
                          >
                            {row.companyName || row.companyId}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {row.campaignId ? (
                          <Link
                            href={`/dashboard/campaigns/${row.campaignId}`}
                            className="text-sm underline underline-offset-2"
                          >
                            {row.campaignName || row.campaignId}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="align-top max-w-md">
                        <p className="text-sm text-red-700 break-words">
                          {row.failureReason || '—'}
                        </p>
                        {row.failureStatusCode && (
                          <p className="mt-1 text-xs text-neutral-500">
                            HTTP {row.failureStatusCode}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm text-neutral-600">
                        {formatDate(row.lastFailedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {typeof messageCount === 'number' &&
            status?.messages &&
            messageCount > status.messages.length && (
              <p className="mt-3 text-xs text-neutral-500">
                Showing {status.messages.length} of {messageCount} message(s). Refresh to peek
                again.
              </p>
            )}
        </CardContent>
      </Card>

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
            when the DLQ count changes or messages return after a redrive. Configure who receives
            those alerts in System Notifications.
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
