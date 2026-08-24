"use client";

import { useState, useEffect } from "react";
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
  Timer,
  Info,
  FileText,
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
  getCronScheduleDescription,
} from "@/lib/cron-display-format";
import { Progress } from "@/components/ui/progress";

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

interface HistoryData {
  history: HistoryItem[];
  totalCount: number;
  page: number;
  totalPages: number;
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
  const [selectedError, setSelectedError] = useState<HistoryItem | null>(null);
  const [selectedDiskDetails, setSelectedDiskDetails] =
    useState<HistoryItem | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<HistoryItem | null>(null);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

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

    fetchCronDetails();
    fetchHistory();
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
        // Refresh details and history
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

  if (authLoading || (isSuperAdminDlqCron(cronName) && !user?.isSuperAdmin)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cron) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Cron Not Found
            </h3>
            <p className="text-muted-foreground">
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

  const successRate =
    totalCount > 0
      ? (
          (history.filter((h) => h.status === "SUCCESS" && h.endTime).length /
            Math.max(1, history.filter((h) => h.endTime).length)) *
          100
        ).toFixed(1)
      : "N/A";

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

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:justify-between xl:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 min-w-0">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="min-w-0">
              <h2 className="text-2xl xl:text-3xl font-bold tracking-tight break-words">
                {cron.displayName}
              </h2>
              <p className="text-muted-foreground break-words">{cron.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                fetchCronDetails();
                fetchHistory();
              }}
              variant="outline"
              disabled={loading || historyLoading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  loading || historyLoading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
            <Button onClick={triggerCron} disabled={triggering || hasRunningJob}>
              {triggering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Trigger Now
            </Button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <Alert
            variant={message.type === "error" ? "destructive" : "default"}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : message.type === "error" ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold break-all">
                    {cron.schedule || "Not scheduled"}
                  </div>
                  <div className="text-xs text-muted-foreground break-words">
                    {getCronScheduleDescription(cron.schedule)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Run
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-bold">
                    {formatCronDateTime(cron.lastRunAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Duration: {formatCronDuration(cron.lastDurationMs)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {cron.isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <div>
                      <Badge variant="secondary">Running</Badge>
                      {runningItem ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCronElapsed(runningItem.startTime, now)}
                          {progressTotal
                            ? ` · ${progressDone}/${progressTotal} companies`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : cron.lastError ? (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">Failed</Badge>
                  </>
                ) : cron.lastRunAt ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <Badge>Success</Badge>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">Pending</Badge>
                  </>
                )}
              </div>
              {cron.lastError && !cron.isRunning && (
                <p className="text-xs text-destructive mt-2 truncate">
                  {cron.lastError}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isDiskMaintenance ? "Space Reclaimed" : "Records Updated"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">
                    {isDiskMaintenance
                      ? formatReclaimedKb(cron.lastRecordsUpdated)
                      : cron.lastRecordsUpdated}
                  </div>
                  <div className="text-xs text-muted-foreground">Last run</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {runningItem && cronName === "microsoftContactsSync" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Companies</div>
                  <div className="font-semibold">
                    {progressDone}/{progressTotal || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Contacts this run</div>
                  <div className="font-semibold">
                    {Number(runningMeta.recordsUpdated || runningItem.recordsUpdated || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                  <div className="font-semibold">{runningMeta.failed || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Current account</div>
                  <div className="font-semibold truncate" title={runningMeta.currentAccount || ""}>
                    {runningMeta.currentAccount || runningMeta.currentCompany || "Starting…"}
                  </div>
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 max-h-56 overflow-auto">
                <div className="text-xs font-medium text-muted-foreground mb-2">Logs</div>
                {(runningMeta.logs || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Waiting for the first log line…</p>
                ) : (
                  <div className="space-y-1 font-mono text-xs">
                    {[...(runningMeta.logs || [])].slice(-20).map((log, index) => (
                      <div key={`${log.at}-${index}`} className="flex gap-2">
                        <span className="text-muted-foreground shrink-0">
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

        {/* Statistics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Execution Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Total Executions
                </div>
                <div className="text-2xl font-bold">{totalCount}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Success Rate
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {typeof successRate === "string" && successRate !== "N/A"
                    ? `${successRate}%`
                    : successRate}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Failed Executions
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {history.filter((h) => h.status === "FAILED").length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Execution History */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Execution History</CardTitle>
                <CardDescription>
                  Showing {history.length} of {totalCount} executions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mb-4 text-muted-foreground/50" />
                <p>No execution history found</p>
              </div>
            ) : (
              <>
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[32%]">Start Time</TableHead>
                      <TableHead className="w-[16%]">Duration</TableHead>
                      <TableHead className="w-[12%]">
                        {isDiskMaintenance ? "Reclaimed" : "Records"}
                      </TableHead>
                      <TableHead className="w-[18%]">Status</TableHead>
                      <TableHead className="w-[22%]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item._id}>
                        <TableCell className="whitespace-normal">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {formatCronDateTime(item.startTime)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-mono">
                              {item.endTime
                                ? formatCronDuration(item.duration)
                                : formatCronElapsed(item.startTime, now)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {formatHistoryMetric(item)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {!item.endTime ? (
                            <Badge variant="secondary">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Running
                            </Badge>
                          ) : item.status === "SUCCESS" ? (
                            <Badge>
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="flex flex-wrap gap-2">
                            {isDiskMaintenance && item.metadata ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedDiskDetails(item)}
                              >
                                <Info className="h-3 w-3 xl:mr-1" />
                                <span className="hidden xl:inline">Details</span>
                              </Button>
                            ) : null}
                            {Array.isArray((item.metadata as MicrosoftSyncMetadata | undefined)?.logs) &&
                            ((item.metadata as MicrosoftSyncMetadata).logs?.length || 0) > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedLogs(item)}
                              >
                                <FileText className="h-3 w-3 xl:mr-1" />
                                <span className="hidden xl:inline">Logs</span>
                              </Button>
                            ) : null}
                            {item.error && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedError(item)}
                              >
                                <AlertCircle className="h-3 w-3 xl:mr-1" />
                                <span className="hidden xl:inline">View Error</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalCount > 0 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Page {page} of {totalPages} ({totalCount} total)
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
                        disabled={page === totalPages}
                      >
                        Next
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error Dialog */}
      <Dialog
        open={selectedError !== null}
        onOpenChange={(open) => !open && setSelectedError(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Execution Error Details
            </DialogTitle>
            <DialogDescription>
              Error occurred at {formatCronDateTime(selectedError?.startTime)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Error Message:</div>
              <div className="h-[200px] w-full rounded-md border p-4 overflow-auto">
                <pre className="text-sm text-destructive whitespace-pre-wrap font-mono">
                  {selectedError?.error || "No error message available"}
                </pre>
              </div>
            </div>
            {selectedError?.errorStack && (
              <div>
                <div className="text-sm font-medium mb-2">Stack Trace:</div>
                <div className="h-[300px] w-full rounded-md border p-4 bg-neutral-900 overflow-auto">
                  <pre className="text-xs text-neutral-100 whitespace-pre-wrap font-mono">
                    {selectedError.errorStack}
                  </pre>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Start Time</div>
                <div className="text-sm">
                  {formatCronDateTime(selectedError?.startTime)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Duration</div>
                <div className="text-sm">
                  {formatCronDuration(selectedError?.duration)}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedLogs !== null} onOpenChange={() => setSelectedLogs(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sync logs</DialogTitle>
            <DialogDescription>
              {selectedLogs?.startTime
                ? `Run started ${formatCronDateTime(selectedLogs.startTime)}`
                : "Run logs"}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 max-h-[60vh] overflow-auto font-mono text-xs space-y-1">
            {((selectedLogs?.metadata as MicrosoftSyncMetadata | undefined)?.logs || []).map(
              (log, index) => (
                <div key={`${log.at}-${index}`} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">
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
              ),
            )}
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
