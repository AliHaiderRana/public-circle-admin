'use client';

import { UserRoundCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  formatAssignmentTimestamp,
  type AssignmentHistoryEntry,
} from '@/lib/support-assignment.util';

type TicketAssignmentHistoryProps = {
  entries: AssignmentHistoryEntry[];
  className?: string;
  compact?: boolean;
};

export function TicketAssignmentHistory({
  entries,
  className,
  compact = false,
}: TicketAssignmentHistoryProps) {
  if (entries.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground italic', className)}>
        No assignments yet.
      </p>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {entries.map((entry) => (
        <Alert key={entry._id ?? `${entry.assignedAt}-${entry.adminId}`}>
          <UserRoundCheck className="size-4" />
          <AlertTitle className={cn('text-sm leading-snug', compact && 'font-normal')}>
            {entry.label}
          </AlertTitle>
          <AlertDescription className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {formatAssignmentTimestamp(entry.assignedAt)}
            </p>
            {entry.note?.trim() ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{entry.note}</p>
            ) : null}
            {entry.anchorMessagePreview?.trim() ? (
              <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-2.5 py-2">
                <span className="font-medium text-foreground/80">After message: </span>
                “{entry.anchorMessagePreview}”
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

type TicketAssignmentHandoffMarkerProps = {
  entry: AssignmentHistoryEntry;
  className?: string;
};

export function TicketAssignmentHandoffMarker({
  entry,
  className,
}: TicketAssignmentHandoffMarkerProps) {
  return (
    <div className={cn('flex justify-center py-1', className)}>
      <Alert className="max-w-[92%]">
        <UserRoundCheck className="size-4" />
        <AlertTitle className="text-xs font-semibold uppercase tracking-wide">
          Assignment change
        </AlertTitle>
        <AlertDescription className="space-y-1">
          <p className="text-sm leading-snug text-foreground">{entry.label}</p>
          {entry.note?.trim() ? (
            <p className="text-sm whitespace-pre-wrap text-foreground/90">{entry.note}</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {formatAssignmentTimestamp(entry.assignedAt)}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
