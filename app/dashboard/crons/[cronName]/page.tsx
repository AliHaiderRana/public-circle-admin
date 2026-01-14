"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CronDetails {
  name: string;
  displayName: string;
  schedule: string | null;
  description: string;
  lastRunAt: string | null;
  lastRecordsUpdated: number;
  lastDurationMs: number | null;
  lastError: string | null;
  isEnabled: boolean;
}

interface HistoryItem {
  _id: string;
  cronName: string;
  startTime: string;
  endTime: string;
  duration: number;
  recordsUpdated: number;
  status: "SUCCESS" | "FAILED";
  error: string | null;
  errorStack: string | null;
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
  const cronName = params.cronName as string;

  const [cron, setCron] = useState<CronDetails | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedError, setSelectedError] = useState<HistoryItem | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    fetchCronDetails();
    fetchHistory();
  }, [cronName, page]);

  const fetchCronDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crons/${cronName}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCron(data.cron);
      } else {
        setMessage({ text: "Failed to load cron details", type: "error" });
      }
    } catch (error) {
      setMessage({ text: "Failed to load cron details", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/crons/${cronName}/history?page=${page}&limit=30`,
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
      setHistoryLoading(false);
    }
  };

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
          fetchCronDetails();
          fetchHistory();
        }, 2000);
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

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleString();
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const getScheduleDescription = (schedule: string | null) => {
    if (!schedule || schedule === "unknown") {
      return "Schedule not available";
    }

    const scheduleMap: Record<string, string> = {
      "*/1 * * * *": "Every minute",
      "*/10 * * * *": "Every 10 minutes",
      "0 0 * * *": "Daily at midnight",
      "0 0 0 * * *": "Daily at midnight",
      "0 1 * * *": "Daily at 1 AM",
      "0 4 * * *": "Daily at 4 AM",
      "0 6 * * *": "Daily at 6 AM",
      "0 0,12 * * *": "Twice daily (12 AM & 12 PM)",
    };
    return scheduleMap[schedule] || schedule;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
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
            <AlertCircle className="h-12 w-12 text-neutral-400 mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Cron Not Found
            </h3>
            <p className="text-neutral-500">
              The requested cron job could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const successRate =
    totalCount > 0
      ? (
          (history.filter((h) => h.status === "SUCCESS").length / totalCount) *
          100
        ).toFixed(1)
      : "N/A";

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {cron.displayName}
              </h2>
              <p className="text-neutral-500">{cron.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
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
            <Button onClick={triggerCron} disabled={triggering}>
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
          <div
            className={`p-4 rounded-lg flex items-center gap-2 ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : message.type === "error"
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-neutral-400" />
                <div>
                  <div className="font-mono text-sm font-bold">
                    {cron.schedule || "Not scheduled"}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {getScheduleDescription(cron.schedule)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Last Run
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-400" />
                <div>
                  <div className="text-sm font-bold">
                    {formatDate(cron.lastRunAt)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Duration: {formatDuration(cron.lastDurationMs)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Last Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {cron.lastError ? (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">Failed</Badge>
                  </>
                ) : cron.lastRunAt ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <Badge className="bg-green-50 text-green-700 border-green-200">
                      Success
                    </Badge>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 text-neutral-400" />
                    <Badge variant="secondary">Pending</Badge>
                  </>
                )}
              </div>
              {cron.lastError && (
                <p className="text-xs text-red-600 mt-2 truncate">
                  {cron.lastError}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Records Updated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-neutral-400" />
                <div>
                  <div className="text-2xl font-bold">
                    {cron.lastRecordsUpdated}
                  </div>
                  <div className="text-xs text-neutral-500">Last run</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                <div className="text-sm text-neutral-500 mb-1">
                  Total Executions
                </div>
                <div className="text-2xl font-bold">{totalCount}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-500 mb-1">
                  Success Rate
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {typeof successRate === "string" && successRate !== "N/A"
                    ? `${successRate}%`
                    : successRate}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-500 mb-1">
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
                <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <Activity className="h-12 w-12 mb-4 text-neutral-300" />
                <p>No execution history found</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-neutral-400" />
                            <span className="text-sm">
                              {formatDate(item.startTime)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-neutral-400" />
                            <span className="text-sm font-mono">
                              {formatDuration(item.duration)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-neutral-400" />
                            <span className="text-sm">
                              {item.recordsUpdated}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.status === "SUCCESS" ? (
                            <Badge className="bg-green-50 text-green-700 border-green-200">
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
                        <TableCell>
                          {item.error && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedError(item)}
                            >
                              <AlertCircle className="mr-1 h-3 w-3" />
                              View Error
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-neutral-500">
                      Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                      >
                        Next
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
              Error occurred at {formatDate(selectedError?.startTime || null)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Error Message:</div>
              <div className="h-[200px] w-full rounded-md border p-4 overflow-auto">
                <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono">
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
                <div className="text-xs text-neutral-500 mb-1">Start Time</div>
                <div className="text-sm">
                  {formatDate(selectedError?.startTime || null)}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500 mb-1">Duration</div>
                <div className="text-sm">
                  {formatDuration(selectedError?.duration || null)}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
