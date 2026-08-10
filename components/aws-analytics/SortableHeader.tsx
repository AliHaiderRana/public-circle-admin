'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown, Info } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

export type SortState<K extends string> = { key: K; dir: SortDirection } | null;

/** Toggles direction on the same key, otherwise starts a new key ascending. */
export function toggleSort<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  if (prev && prev.key === key) {
    return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: 'asc' };
}

export function compareValues(
  a: string | number,
  b: string | number,
  direction: SortDirection
): number {
  const cmp =
    typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a) - Number(b);
  return direction === 'asc' ? cmp : -cmp;
}

export function SortableHeader<K extends string>({
  label,
  info,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
  align = 'left',
}: {
  label: string;
  info?: string;
  sortKey: K;
  activeKey: K | null;
  direction: SortDirection;
  onSort: (key: K) => void;
  className?: string;
  align?: 'left' | 'right';
}) {
  const active = activeKey === sortKey;
  return (
    <TableHead className={className}>
      <div className={cn('inline-flex items-center gap-1', align === 'right' && 'w-full justify-end')}>
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn(
            'inline-flex items-center gap-1 hover:text-foreground',
            active ? 'text-foreground' : 'text-muted-foreground'
          )}
          aria-label={`Sort by ${label}`}
        >
          {label}
          {active ? (
            direction === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
        {info && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="cursor-help" aria-label={`About ${label}`}>
                <Info className="h-3 w-3 text-muted-foreground/70" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64 text-xs">
              {info}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TableHead>
  );
}
