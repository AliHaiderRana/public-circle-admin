'use client';

import { Loader2, ScrollText, UserRoundCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatTimelineTimestamp,
  type TicketHistoryEntry,
} from '@/lib/support-status-timeline.util';

type TicketStatusTimelineProps = {
  entries: TicketHistoryEntry[];
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
        <div key={entry._id ?? `${entry.kind}-${entry.changedAt}-${index}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                'mt-1.5 size-2 shrink-0 rounded-full',
                entry.kind === 'assignment'
                  ? 'bg-violet-500/80'
                  : entry.kind === 'audit'
                    ? 'bg-amber-500/80'
                    : 'bg-primary/70',
              )}
            />
            {index < entries.length - 1 && (
              <span className="my-1 w-px flex-1 bg-border min-h-6" />
            )}
          </div>
          <div className={cn('min-w-0 flex-1', index < entries.length - 1 && 'pb-3')}>
            {entry.kind === 'status' ? (
              <>
                <p className={cn('leading-snug', compact ? 'text-sm' : 'text-sm font-medium')}>
                  {entry.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatTimelineTimestamp(entry.changedAt)}
                  {entry.statusLabel ? ` · ${entry.statusLabel}` : ''}
                </p>
              </>
            ) : entry.kind === 'assignment' ? (
              <div className="rounded-lg border border-violet-200/80 bg-violet-50/60 p-2.5 dark:border-violet-900/50 dark:bg-violet-950/20">
                <div className="flex items-start gap-2">
                  <UserRoundCheck className="mt-0.5 size-3.5 shrink-0 text-violet-700 dark:text-violet-300" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={cn('leading-snug', compact ? 'text-sm' : 'text-sm font-medium')}>
                      {entry.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimelineTimestamp(entry.changedAt)}
                    </p>
                    {entry.note?.trim() ? (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{entry.note}</p>
                    ) : null}
                    {entry.anchorMessagePreview?.trim() ? (
                      <p className="text-xs text-muted-foreground rounded-md border bg-background/70 px-2 py-1.5">
                        <span className="font-medium text-foreground/80">After message: </span>
                        “{entry.anchorMessagePreview}”
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/15">
                <div className="flex items-start gap-2">
                  <ScrollText className="mt-0.5 size-3.5 shrink-0 text-amber-800 dark:text-amber-300" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={cn('leading-snug', compact ? 'text-sm' : 'text-sm font-medium')}>
                      {entry.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimelineTimestamp(entry.changedAt)}
                      {entry.actorName ? ` · ${entry.actorName}` : ''}
                      {entry.actorIsPartner
                        ? entry.referralRole === 'SALES_PERSON'
                          ? ' · Sales partner'
                          : entry.referralRole === 'MARKETING_AFFILIATE'
                            ? ' · Marketing partner'
                            : ' · Support partner'
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
