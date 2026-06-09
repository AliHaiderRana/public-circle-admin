'use client';

import { UserRoundCheck } from 'lucide-react';
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
        <div
          key={entry._id ?? `${entry.assignedAt}-${entry.adminId}`}
          className="rounded-lg border border-violet-200/80 bg-violet-50/70 p-3 dark:border-violet-900/50 dark:bg-violet-950/20"
        >
          <div className="flex items-start gap-2">
            <UserRoundCheck className="mt-0.5 size-4 shrink-0 text-violet-700 dark:text-violet-300" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className={cn('leading-snug', compact ? 'text-sm' : 'text-sm font-medium')}>
                {entry.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatAssignmentTimestamp(entry.assignedAt)}
              </p>
              {entry.note?.trim() ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{entry.note}</p>
              ) : null}
              {entry.anchorMessagePreview?.trim() ? (
                <p className="text-xs text-muted-foreground rounded-md border bg-background/70 px-2.5 py-2">
                  <span className="font-medium text-foreground/80">After message: </span>
                  “{entry.anchorMessagePreview}”
                </p>
              ) : null}
            </div>
          </div>
        </div>
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
      <div className="w-full max-w-[92%] rounded-xl border border-violet-200/80 bg-violet-50/80 px-3.5 py-3 dark:border-violet-900/50 dark:bg-violet-950/25">
        <div className="flex items-start gap-2">
          <UserRoundCheck className="mt-0.5 size-4 shrink-0 text-violet-700 dark:text-violet-300" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
              Assignment change
            </p>
            <p className="text-sm leading-snug">{entry.label}</p>
            {entry.note?.trim() ? (
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{entry.note}</p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              {formatAssignmentTimestamp(entry.assignedAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
