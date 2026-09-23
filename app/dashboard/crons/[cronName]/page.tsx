"use client";

import { useState, useEffect, type ComponentType, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isSuperAdminDlqCron } from "@/lib/dlq-access";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  XCircle,
  Calendar,
  Activity,
  Database,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DiskMaintenanceDetailsDialog } from "@/components/DiskMaintenanceDetailsDialog";
import {
  formatReclaimedKb,
  isDiskMaintenanceCron,
  type DiskMaintenanceMetadata,
} from "@/lib/disk-maintenance-format";
import {
  formatCronDateTime,
  formatCronDuration,
  formatCronElapsed,
  resolveCronDurationMs,
  getCronScheduleDescription,
} from "@/lib/cron-display-format";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface CronDetails {
  name: string;
  displayName: string;
  schedule: string | null;
  description: string;
  lastRunAt: string | null;
  lastRecordsUpdated: number;
  lastDurationMs: number | null;
  lastError: string | null;
  isRunning?: boolean;
  isEnabled: boolean;
}

interface MicrosoftSyncLog {
  at?: string;
  message?: string;
}

interface MicrosoftSyncMetadata {
  configs?: number;
  processed?: number;
  failed?: number;
  imported?: number;
  updated?: number;
  skipped?: number;
  recordsUpdated?: number;
  currentCompany?: string | null;
  currentAccount?: string | null;
  stage?: string;
  logs?: MicrosoftSyncLog[];
  reclaimedHuman?: string;
  reclaimedKb?: number;
}

interface HistoryItem {
  _id: string;
  cronName: string;
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  recordsUpdated: number;
  status: "SUCCESS" | "FAILED";
  error: string | null;
  errorStack: string | null;
  metadata?: MicrosoftSyncMetadata | DiskMaintenanceMetadata | null;
  createdAt: string;
}

function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function OverviewStat({
  icon: Icon,
  label,
  value,
  hint,
  iconClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  iconClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className={cn("size-4 text-muted-foreground", iconClassName)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="mt-0.5 text-sm font-semibold leading-snug break-words">
              {value}
            </div>
            {hint ? (
              <div className="mt-0.5 text-[11px] text-muted-foreground break-words">
                {hint}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CronDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const cronName = params.cronName as string;

  const [cron, setCron] = useState<CronDetails | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [selectedError, setSelectedError] = useState<HistoryItem | null>(null);
  const [selectedDiskDetails, setSelectedDiskDetails] =
    useState<HistoryItem | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<HistoryItem | null>(null);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const fetchCronDetails = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/crons/${cronName}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCron(data.cron);
      } else if (!silent) {
        setMessage({ text: "Failed to load cron details", type: "error" });
      }
    } catch (error) {
      if (!silent) setMessage({ text: "Failed to load cron details", type: "error" });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchHistory = async ({ silent = false } = {}) => {
    if (!silent) setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/crons/${cronName}/history?page=${page}&limit=${pageSize}`,
        {
          credentials: "include",
        }
      );
      if (res.ok) {
        const response = await res.json();
        const data = response.data || response;
        setHistory(data.history || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
        setFailedCount(data.failedCount || 0);
        setSuccessCount(data.successCount || 0);
      }
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isSuperAdminDlqCron(cronName) && user && !user.isSuperAdmin) {
      router.push("/dashboard/crons");
      return;
    }

    let cancelled = false;
    (async () => {
      await Promise.all([
        fetchCronDetails({ silent: initialLoadDone }),
        fetchHistory({ silent: initialLoadDone }),
      ]);
      if (!cancelled) setInitialLoadDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [cronName, page, pageSize, authLoading, user, router]);

  const hasRunningJob =
    Boolean(cron?.isRunning) || history.some((item) => !item.endTime);

  useEffect(() => {
    if (!hasRunningJob) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [hasRunningJob]);

  useEffect(() => {
    if (!hasRunningJob) return;
    const poll = window.setInterval(() => {
      fetchCronDetails({ silent: true });
      fetchHistory({ silent: true });
    }, 3000);
    return () => window.clearInterval(poll);
  }, [hasRunningJob, cronName, page, pageSize]);

  const triggerCron = async () => {
    setTriggering(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/crons/trigger/${cronName}`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          text: `${cronName} triggered successfully`,
          type: "success",
        });
        setTimeout(() => {
          fetchCronDetails({ silent: true });
          fetchHistory({ silent: true });
        }, 800);
      } else {
        setMessage({
          text: data.error || "Failed to trigger cron",
          type: "error",
        });
      }
    } catch (error) {
      setMessage({ text: "Failed to trigger cron", type: "error" });
    } finally {
      setTriggering(false);
    }
  };

  const pageLoading =
    authLoading ||
    (isSuperAdminDlqCron(cronName) && !user?.isSuperAdmin) ||
    (!initialLoadDone && (loading || historyLoading));

  if (pageLoading) {
    return <PageLoader label="Loading cron details…" />;
  }

  if (!cron) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-medium">Cron not found</h3>
            <p className="text-sm text-muted-foreground">
              The requested cron job could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDiskMaintenance = isDiskMaintenanceCron(cronName);

  const formatHistoryMetric = (item: HistoryItem) => {
    if (isDiskMaintenance) {
      return (
        item.metadata?.reclaimedHuman ||
        formatReclaimedKb(item.recordsUpdated)
      );
    }
    return String(item.recordsUpdated);
  };

  const resolvedSuccessCount =
    successCount > 0 || failedCount > 0
      ? successCount
      : Math.max(0, totalCount - failedCount);
  const successRate =
    totalCount > 0
      ? `${((resolvedSuccessCount / totalCount) * 100).toFixed(1)}%`
      : "—";

  const runningItem = history.find((item) => !item.endTime) || null;
  const runningMeta = (runningItem?.metadata || {}) as MicrosoftSyncMetadata;
  const progressTotal = Number(runningMeta.configs) || 0;
  const progressDone = Number(runningMeta.processed) || 0;
  const progressPercent =
    progressTotal > 0
      ? Math.min(100, Math.round((progressDone / progressTotal) * 100))
      : runningItem
        ? 8
        : 0;

  const lastStatusNode = cron.isRunning ? (
    <Badge variant="secondary" className="gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      Running
    </Badge>
  ) : cron.lastError ? (
    <Badge variant="destructive">Failed</Badge>
  ) : cron.lastRunAt ? (
    <Badge>Success</Badge>
  ) : (
    <Badge variant="secondary">Pending</Badge>
  );

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 px-2 text-muted-foreground"
              onClick={() => router.push("/dashboard/crons")}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Cron jobs
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight break-words">
                {cron.displayName}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                {cron.description}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchCronDetails();
                void fetchHistory();
              }}
              disabled={loading || historyLoading}
            >
              <RefreshCw
                className={cn(
                  "mr-2 h-4 w-4",
                  (loading || historyLoading) && "animate-spin",
                )}
              />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void triggerCron()}
              disabled={triggering || hasRunningJob}
            >
              {triggering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Trigger now
            </Button>
          </div>
        </div>

        {message ? (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : message.type === "error" ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewStat
            icon={Clock}
            label="Schedule"
            value={
              <span className="font-mono text-sm">
                {cron.schedule || "Not scheduled"}
              </span>
            }
            hint={getCronScheduleDescription(cron.schedule)}
          />
          <OverviewStat
            icon={Calendar}
            label="Last run"
            value={formatCronDateTime(cron.lastRunAt)}
            hint={`Duration ${formatCronDuration(cron.lastDurationMs)}`}
          />
          <OverviewStat
            icon={cron.isRunning ? Loader2 : cron.lastError ? XCircle : CheckCircle2}
            iconClassName={cron.isRunning ? "animate-spin" : undefined}
            label="Last status"
            value={lastStatusNode}
            hint={
              cron.isRunning && runningItem
                ? `${formatCronElapsed(runningItem.startTime, now)}${
                    progressTotal
                      ? ` · ${progressDone}/${progressTotal} companies`
                      : ""
                  }`
                : cron.lastError && !cron.isRunning
                  ? cron.lastError
                  : undefined
            }
          />
          <OverviewStat
            icon={Database}
            label={isDiskMaintenance ? "Space reclaimed" : "Records updated"}
            value={
              isDiskMaintenance
                ? formatReclaimedKb(cron.lastRecordsUpdated)
                : cron.lastRecordsUpdated.toLocaleString()
            }
            hint="Last run"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-lg border bg-card p-3 sm:p-4">
          <div>
            <p className="text-xs text-muted-foreground">Total executions</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">
              {totalCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Success rate</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {successRate}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">
              {failedCount.toLocaleString()}
            </p>
          </div>
        </div>

        {runningItem && cronName === "microsoftContactsSync" ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Loader2 className="h-4 w-4 animate-spin" />
                Live progress
              </CardTitle>
              <CardDescription>
                Elapsed {formatCronElapsed(runningItem.startTime, now)}
                {progressTotal
                  ? ` · company ${Math.min(progressDone + (runningMeta.currentCompany ? 1 : 0), progressTotal)} of ${progressTotal}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progressPercent} />
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">Companies</div>
                  <div className="font-semibold tabular-nums">
                    {progressDone}/{progressTotal || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Contacts</div>
                  <div className="font-semibold tabular-nums">
                    {Number(
                      runningMeta.recordsUpdated ||
                        runningItem.recordsUpdated ||
                        0,
                    ).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                  <div className="font-semibold tabular-nums">
                    {runningMeta.failed || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Current</div>
                  <div
                    className="truncate font-semibold"
                    title={runningMeta.currentAccount || ""}
                  >
                    {runningMeta.currentAccount ||
                      runningMeta.currentCompany ||
                      "Starting…"}
                  </div>
                </div>
              </div>
              <div className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Logs
                </div>
                {(runningMeta.logs || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Waiting for the first log line…
                  </p>
                ) : (
                  <div className="space-y-1 font-mono text-xs">
                    {[...(runningMeta.logs || [])].slice(-20).map((log, index) => (
                      <div key={`${log.at}-${index}`} className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground">
                          {log.at
                            ? new Date(log.at).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : ""}
                        </span>
                        <span className="break-all">{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Execution history</CardTitle>
                <CardDescription>
                  {totalCount > 0
                    ? `Showing ${history.length} of ${totalCount} executions`
                    : "No executions yet"}
                </CardDescription>
              </div>
              {historyLoading && initialLoadDone ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading && !history.length ? (
              <div className="space-y-2 px-6 py-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <Activity className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm">No execution history found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Start time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>
                          {isDiskMaintenance ? "Reclaimed" : "Records"}
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((item) => (
                        <TableRow key={item._id}>
                          <TableCell className="pl-6 text-sm">
                            {formatCronDateTime(item.startTime)}
                          </TableCell>
                          <TableCell className="font-mono text-sm tabular-nums">
                            {item.endTime
                              ? formatCronDuration(resolveCronDurationMs(item))
                              : formatCronElapsed(item.startTime, now)}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {formatHistoryMetric(item)}
                          </TableCell>
                          <TableCell>
                            {!item.endTime ? (
                              <Badge variant="secondary" className="gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Running
                              </Badge>
                            ) : item.status === "SUCCESS" ? (
                              <Badge>Success</Badge>
                            ) : (
                              <Badge variant="destructive">Failed</Badge>
                            )}
                          </TableCell>
                          <TableCell className="pr-6">
                            <div className="flex flex-wrap gap-2">
                              {isDiskMaintenance && item.metadata ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedDiskDetails(item)}
                                >
                                  Details
                                </Button>
                              ) : null}
                              {Array.isArray(
                                (item.metadata as MicrosoftSyncMetadata | undefined)
                                  ?.logs,
                              ) &&
                              ((item.metadata as MicrosoftSyncMetadata).logs
                                ?.length || 0) > 0 ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedLogs(item)}
                                >
                                  Logs
                                </Button>
                              ) : null}
                              {item.error ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedError(item)}
                                >
                                  View error
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalCount > 0 ? (
                  <div className="flex items-center justify-between border-t px-6 py-4">
                    <div className="text-sm text-muted-foreground">
                      Page {page} of {Math.max(totalPages, 1)} ({totalCount}{" "}
                      total)
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                          setPageSize(parseInt(value, 10));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={selectedError !== null}
        onOpenChange={(open) => !open && setSelectedError(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Execution error details
            </DialogTitle>
            <DialogDescription>
              Error occurred at {formatCronDateTime(selectedError?.startTime)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium">Error message</div>
              <div className="h-[200px] w-full overflow-auto rounded-md border p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm text-destructive">
                  {selectedError?.error || "No error message available"}
                </pre>
              </div>
            </div>
            {selectedError?.errorStack ? (
              <div>
                <div className="mb-2 text-sm font-medium">Stack trace</div>
                <div className="h-[300px] w-full overflow-auto rounded-md border bg-neutral-900 p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs text-neutral-100">
                    {selectedError.errorStack}
                  </pre>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Start time</div>
                <div className="text-sm">
                  {formatCronDateTime(selectedError?.startTime)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Duration</div>
                <div className="text-sm">
                  {formatCronDuration(resolveCronDurationMs(selectedError))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedLogs !== null} onOpenChange={() => setSelectedLogs(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sync logs</DialogTitle>
            <DialogDescription>
              {selectedLogs?.startTime
                ? `Run started ${formatCronDateTime(selectedLogs.startTime)}`
                : "Run logs"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
            {(
              (selectedLogs?.metadata as MicrosoftSyncMetadata | undefined)?.logs ||
              []
            ).map((log, index) => (
              <div key={`${log.at}-${index}`} className="flex gap-2">
                <span className="shrink-0 text-muted-foreground">
                  {log.at
                    ? new Date(log.at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : ""}
                </span>
                <span className="break-all">{log.message}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <DiskMaintenanceDetailsDialog
        open={selectedDiskDetails !== null}
        onOpenChange={(open) => !open && setSelectedDiskDetails(null)}
        metadata={selectedDiskDetails?.metadata || null}
        startTime={selectedDiskDetails?.startTime}
      />
    </>
  );
}
