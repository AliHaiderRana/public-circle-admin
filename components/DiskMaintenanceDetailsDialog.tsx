"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HardDrive, AlertTriangle } from "lucide-react";
import type { DiskMaintenanceMetadata } from "@/lib/disk-maintenance-format";
import { formatCronDateTime } from "@/lib/cron-display-format";

interface DiskMaintenanceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: DiskMaintenanceMetadata | null;
  startTime?: string | null;
}

export function DiskMaintenanceDetailsDialog({
  open,
  onOpenChange,
  metadata,
  startTime,
}: DiskMaintenanceDetailsDialogProps) {
  if (!metadata) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Disk Maintenance Details
          </DialogTitle>
          <DialogDescription>
            {startTime ? `Run at ${formatCronDateTime(startTime)}` : "Run details"}
            {metadata.triggeredBy ? ` · triggered by ${metadata.triggeredBy}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">Space Reclaimed</div>
            <div className="text-2xl font-bold text-foreground">
              {metadata.reclaimedHuman || "0K"}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">Disk Usage</div>
            <div className="text-lg font-semibold">
              {metadata.diskUsePercentBefore ?? "?"}% → {metadata.diskUsePercentAfter ?? "?"}%
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">Free Space</div>
            <div className="text-lg font-semibold">
              {metadata.freeHumanBefore || "?"} → {metadata.freeHumanAfter || "?"}
            </div>
          </div>
        </div>

        {metadata.warning ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {metadata.warning}
            </AlertDescription>
          </Alert>
        ) : null}

        {metadata.pm2Logrotate ? (
          <div className="rounded-lg border p-4 space-y-2">
            <div className="font-medium">PM2 Log Rotation</div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={metadata.pm2Logrotate.configured ? "default" : "secondary"}>
                {metadata.pm2Logrotate.configured ? "Configured" : "Not configured"}
              </Badge>
              <Badge variant="outline">max {metadata.pm2Logrotate.maxSize || "5M"}</Badge>
              <Badge variant="outline">retain {metadata.pm2Logrotate.retain ?? 7}</Badge>
              {metadata.pm2Logrotate.compress ? (
                <Badge variant="outline">compressed</Badge>
              ) : null}
            </div>
            <div className="text-sm text-muted-foreground">
              PM2 logs freed:{" "}
              <span className="font-medium">
                {Math.max(0, metadata.pm2Logrotate.logsFreedKb || 0) >= 1024
                  ? `${Math.round((metadata.pm2Logrotate.logsFreedKb || 0) / 1024)}M`
                  : `${metadata.pm2Logrotate.logsFreedKb || 0}K`}
              </span>
            </div>
          </div>
        ) : null}

        {metadata.actions && metadata.actions.length > 0 ? (
          <div className="space-y-2">
            <div className="font-medium">Cleanup Actions</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>Freed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metadata.actions.map((action) => (
                  <TableRow key={`${action.name}-${action.freedKb}`}>
                    <TableCell>{action.name}</TableCell>
                    <TableCell>{action.beforeHuman || "-"}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {action.freedHuman || "0K"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {metadata.pathsAfter && metadata.pathsAfter.length > 0 ? (
          <div className="space-y-2">
            <div className="font-medium">Disk Snapshot After Cleanup</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metadata.pathsAfter.map((entry) => (
                  <TableRow key={entry.path}>
                    <TableCell className="font-mono text-xs">{entry.path}</TableCell>
                    <TableCell>{entry.sizeHuman}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {(metadata.logFile || metadata.reportFile) && (
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            {metadata.reportFile ? <div>Report: {metadata.reportFile}</div> : null}
            {metadata.logFile ? <div>Run log: {metadata.logFile}</div> : null}
            {metadata.hostname ? <div>Host: {metadata.hostname}</div> : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
