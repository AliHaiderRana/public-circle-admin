'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatTimelineTimestamp,
  type StatusTimelineEntry,
} from '@/lib/support-status-timeline.util';

type TicketStatusTimelineProps = {
  entries: StatusTimelineEntry[];
  loading?: boolean;
  className?: string;
  compact?: boolean;
};

export function TicketStatusTimeline({
  entries,
  loading = false,
  className,
  compact = false,
}: TicketStatusTimelineProps) {
  if (loading) {
    return (
      <div className={cn('flex justify-center py-6', className)}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground italic py-2', className)}>
        No history recorded yet.
      </p>
    );
  }

  return (
    <div className={cn('space-y-0', className)} aria-label="Ticket history timeline">
      {entries.map((entry, index) => (
        <div key={entry._id ?? `${entry.changedAt}-${index}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/70" />
            {index < entries.length - 1 && (
              <span className="my-1 w-px flex-1 bg-border min-h-6" />
            )}
          </div>
          <div className={cn('min-w-0 flex-1', index < entries.length - 1 && 'pb-3')}>
            <p className={cn('leading-snug', compact ? 'text-sm' : 'text-sm font-medium')}>
              {entry.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatTimelineTimestamp(entry.changedAt)}
              {entry.statusLabel ? ` · ${entry.statusLabel}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
