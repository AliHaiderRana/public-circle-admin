'use client';

import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const ADMIN_ACTIVITY_PAGE_SIZES = [10, 15, 25, 50] as const;

type AdminActivityPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  loading?: boolean;
  compact?: boolean;
  sticky?: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: number[];
};

export default function AdminActivityPagination({
  page,
  totalPages,
  total,
  limit,
  loading = false,
  compact = false,
  sticky = false,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [...ADMIN_ACTIVITY_PAGE_SIZES],
}: AdminActivityPaginationProps) {
  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground py-3 text-center border-t">
        No records to show
      </p>
    );
  }

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const canGoPrev = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const selectId = compact ? 'activity-page-size-compact' : 'activity-page-size';

  return (
    <div
      className={cn(
        'border-t bg-muted/30',
        compact ? 'px-0 py-3' : 'px-1 py-4 mt-6',
        sticky && 'shrink-0 z-10 -mx-0 rounded-b-lg'
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-3',
          compact ? 'sm:flex-row sm:items-center sm:justify-between' : 'sm:flex-row sm:items-center sm:justify-between'
        )}
      >
        <p className="text-sm text-muted-foreground order-2 sm:order-1">
          Showing{' '}
          <span className="font-medium text-foreground">
            {start}–{end}
          </span>{' '}
          of <span className="font-medium text-foreground">{total}</span>
          {total === 1 ? ' action' : ' actions'}
        </p>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 order-1 sm:order-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={selectId} className="text-xs text-muted-foreground whitespace-nowrap">
              Rows per page
            </Label>
            <Select
              value={String(limit)}
              onValueChange={(v) => onLimitChange(Number(v))}
              disabled={loading}
            >
              <SelectTrigger id={selectId} className="h-8 w-[4.25rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Pagination className="mx-0 w-auto" aria-label="Activity pagination">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (canGoPrev) onPageChange(page - 1);
                  }}
                  aria-disabled={!canGoPrev || undefined}
                  className={cn(!canGoPrev && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink
                  href="#"
                  isActive
                  onClick={(e) => e.preventDefault()}
                  className="w-auto px-3 tabular-nums"
                >
                  {page} / {Math.max(1, totalPages)}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (canGoNext) onPageChange(page + 1);
                  }}
                  aria-disabled={!canGoNext || undefined}
                  className={cn(!canGoNext && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}
