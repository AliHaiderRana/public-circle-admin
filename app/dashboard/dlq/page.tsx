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
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import DlqFailedMessagesPanel from '@/components/DlqFailedMessagesPanel';
import type { DlqStatus } from '@/app/api/dlq/route';

function DlqQueueStatusSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading queue status from SQS…
      </div>
      <div className="space-y-6">
        <div className="flex items-end gap-3">
          <Skeleton className="h-14 w-20" />
          <Skeleton className="h-4 w-32 mb-2" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
    </div>
  );
}

function DlqMessagesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading failure records…
      </div>
      <Skeleton className="h-4 w-64" />
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 max-w-sm" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="rounded-md border overflow-hidden">
        <div className="border-b bg-muted/40 px-4 py-3 flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b last:border-0 px-4 py-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return '—';
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchStatus = useCallback(
    async (options?: { silent?: boolean; page?: number; pageSize?: number; search?: string }) => {
      if (!options?.silent) setLoading(true);
      else setRefreshing(true);

      setMessage(null);

      const nextPage = options?.page ?? page;
      const nextPageSize = options?.pageSize ?? pageSize;
      const nextSearch = options?.search ?? debouncedSearch;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        const qs = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(nextPageSize),
        });
        if (nextSearch) qs.set('search', nextSearch);

        const res = await fetch(`/api/dlq?${qs}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await res.json();

        if (!res.ok) {
          setMessage({ type: 'error', text: data.error || 'Failed to load DLQ status' });
          return;
        }

        setStatus(data);
        setLastRefreshedAt(new Date().toISOString());
      } catch (err) {
        const text =
          err instanceof Error && err.name === 'AbortError'
            ? 'DLQ load timed out — restart the server and try again.'
            : 'Failed to load DLQ status';
        setMessage({ type: 'error', text });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, debouncedSearch],
  );

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchStatus({ silent: !!status, page, pageSize, search: debouncedSearch });
    }
    // Intentionally depend on pagination/search — status omitted to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page, pageSize, debouncedSearch, fetchStatus]);

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

      setMessage({
        type: 'success',
        text: `${data.message || 'Redrive complete'} (${data.data?.resentCount ?? 0} message(s) moved back to SQS)`,
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const messageCount = status?.dlqMessageCount;
  const messagesInFlight = status?.dlqMessagesInFlight ?? 0;
  const hasMessages = typeof messageCount === 'number' && messageCount > 0;
  const dbFailureCount = status?.dbFailureCount ?? 0;
  const syncIncomplete = status?.syncIncomplete === true;
  const pagination = status?.pagination;
  const listTotal = pagination?.total ?? 0;

  const isInitialLoad = loading && !status;
  const isRefreshing = refreshing && !!status;

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dead Letter Queue</h2>
          <p className="text-muted-foreground">
            Failed outbound campaign emails. Alert recipients:{' '}
            <Link href="/dashboard/system-notifications" className="underline underline-offset-2">
              System Notifications
            </Link>
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchStatus({ silent: true })} disabled={loading || refreshing}>
          <RefreshCw className={cn('mr-2 h-4 w-4', (loading || refreshing) && 'animate-spin')} />
          {loading || refreshing ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : message.type === 'error' ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Queue status</CardTitle>
              <CardDescription>
                Live SQS counts — available messages waiting in the queue, and in-flight messages
                temporarily hidden while being read.
              </CardDescription>
            </div>
            {status?.environment && <Badge variant="outline">{status.environment}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 relative">
          {isInitialLoad ? (
            <DlqQueueStatusSkeleton />
          ) : (
            <div className={cn('space-y-6', isRefreshing && 'opacity-50 pointer-events-none')}>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <div
                    className={cn(
                      'text-5xl font-bold tracking-tight tabular-nums',
                      hasMessages ? 'text-red-600' : 'text-green-600',
                    )}
                  >
                    {typeof messageCount === 'number' ? messageCount : '—'}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">available</div>
                </div>
                <div>
                  <div
                    className={cn(
                      'text-3xl font-semibold tracking-tight tabular-nums',
                      messagesInFlight > 0 ? 'text-blue-600' : 'text-muted-foreground',
                    )}
                  >
                    {messagesInFlight}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">in flight</div>
                </div>
              </div>

              {messagesInFlight > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {messagesInFlight} message{messagesInFlight === 1 ? '' : 's'} are in flight — temporarily
                    hidden while SQS delivers them to a consumer. Wait ~30 seconds and refresh.
                  </AlertDescription>
                </Alert>
              )}

              {syncIncomplete && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    SQS reports {messageCount} available, but only {dbFailureCount} failure record
                    {dbFailureCount === 1 ? '' : 's'} are synced in the database. The list below is
                    paginated from those records.
                  </AlertDescription>
                </Alert>
              )}

              {status?.countError && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Could not fetch live count: {status.countError}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <div className="text-muted-foreground">Last alert sent</div>
                  <div className="font-medium">{formatDate(status?.dlqLastAlertAt ?? null)}</div>
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <div className="text-muted-foreground">Refreshed</div>
                  <div className="font-medium">{formatDate(lastRefreshedAt)}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setConfirmRedriveOpen(true)} disabled={!hasMessages || redriving}>
                  {redriving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Redrive DLQ to SQS
                </Button>
              </div>
            </div>
          )}
          {isRefreshing && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Failed messages</CardTitle>
          <CardDescription>
            Click a row for full error details. Company, campaign, and run names link to their admin pages.
            Pages load from the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          {isInitialLoad ? (
            <DlqMessagesSkeleton />
          ) : status?.messagesError ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Could not load message details: {status.messagesError}
              </AlertDescription>
            </Alert>
          ) : hasMessages && listTotal === 0 && !debouncedSearch ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-800">
                {messageCount} message(s) in the DLQ, but no failure records are synced in the database
                yet. The DLQ monitor cron reconciles records every 10 minutes.
              </p>
              <Button variant="outline" size="sm" onClick={() => fetchStatus({ silent: true })} disabled={refreshing}>
                <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          ) : !hasMessages && listTotal === 0 ? (
            <p className="text-sm text-muted-foreground">No failed messages in the DLQ right now.</p>
          ) : (
            <DlqFailedMessagesPanel
              messages={status?.messages || []}
              totalInDlq={status?.dlqMessageCount ?? null}
              messagesInFlight={status?.dlqMessagesInFlight}
              syncIncomplete={syncIncomplete}
              dbFailureCount={dbFailureCount}
              maxRetriesBeforeDlq={status?.maxRetriesBeforeDlq}
              pagination={pagination}
              page={page}
              pageSize={pageSize}
              stats={status?.stats}
              search={search}
              onSearchChange={setSearch}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onRetryLoad={() => fetchStatus({ silent: true })}
              retrying={refreshing}
            />
          )}
          {isRefreshing && !isInitialLoad && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Refreshing…
              </div>
            </div>
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
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Messages fail at <code className="rounded bg-muted px-1">/campaigns/sst-email</code>, retry up
            to {status?.maxRetriesBeforeDlq ?? 5} times, then move to the DLQ. The list is paginated from
            synced failure records in the database; the available count comes from live SQS. Fix the root
            cause before redriving. Failure records are reconciled with the DLQ automatically every 10
            minutes by the DLQ monitor cron.
          </p>
        </CardContent>
      </Card>

      <Dialog open={confirmRedriveOpen} onOpenChange={setConfirmRedriveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redrive DLQ messages to SQS?</DialogTitle>
            <DialogDescription>
              Move {messageCount ?? 0} message(s) back to the outbound queue for reprocessing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRedriveOpen(false)} disabled={redriving}>
              Cancel
            </Button>
            <Button onClick={handleRedrive} disabled={redriving}>
              {redriving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Confirm redrive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
