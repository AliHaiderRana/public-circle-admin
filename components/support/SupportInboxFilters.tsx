'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SupportCountBadge } from '@/components/SupportCountBadge';
import { cn } from '@/lib/utils';
import { ListFilter, Search, X } from 'lucide-react';

type CategoryOption = { value: string; label: string };

type AssignableAdmin = {
  id: string;
  name: string;
  isSuperAdmin: boolean;
};

type SupportInboxFiltersProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  activeOnlyFilter: boolean;
  onActiveOnlyToggle: () => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  statusOptions: { value: string; label: string }[];
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  categoryOptions: CategoryOption[];
  isSuperAdmin: boolean;
  assignableAdmins: AssignableAdmin[];
  currentAdminId?: string;
  openTicketCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
};

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] font-medium leading-none transition-colors',
        active
          ? 'border-primary/35 bg-primary/10 text-primary'
          : 'border-transparent bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function SupportInboxFilters({
  searchTerm,
  onSearchChange,
  assigneeFilter,
  onAssigneeFilterChange,
  activeOnlyFilter,
  onActiveOnlyToggle,
  statusFilter,
  onStatusChange,
  statusOptions,
  categoryFilter,
  onCategoryChange,
  categoryOptions,
  isSuperAdmin,
  assignableAdmins,
  currentAdminId,
  openTicketCount,
  hasActiveFilters,
  onClearFilters,
}: SupportInboxFiltersProps) {
  const assigneeSelectValue =
    assigneeFilter === 'unassigned' ? 'all' : assigneeFilter;

  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count += 1;
    if (categoryFilter) count += 1;
    if (
      isSuperAdmin &&
      assigneeFilter !== 'all' &&
      assigneeFilter !== 'unassigned'
    ) {
      count += 1;
    }
    return count;
  }, [statusFilter, categoryFilter, assigneeFilter, isSuperAdmin]);

  return (
    <div className="shrink-0 space-y-1.5 border-b bg-background px-2 py-2">
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            className="h-7 border-muted bg-muted/30 pl-7 text-xs shadow-none"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative size-7 shrink-0"
              aria-label="More filters"
            >
              <ListFilter className="size-3.5" />
              {advancedFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                  {advancedFilterCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 space-y-2 p-2">
            <DropdownMenuLabel className="px-1 py-0 text-[10px] font-medium text-muted-foreground">
              Refine list
            </DropdownMenuLabel>

            <Select
              value={statusFilter || 'all'}
              onValueChange={(value) => onStatusChange(value === 'all' ? '' : value)}
              disabled={activeOnlyFilter}
            >
              <SelectTrigger className="h-8 w-full text-xs" disabled={activeOnlyFilter}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={categoryFilter || 'all'}
              onValueChange={(value) => onCategoryChange(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any category</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isSuperAdmin ? (
              <Select value={assigneeSelectValue} onValueChange={onAssigneeFilterChange}>
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any assignee</SelectItem>
                  {currentAdminId ? (
                    <SelectItem value="me">Assigned to me</SelectItem>
                  ) : null}
                  {assignableAdmins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip
          active={assigneeFilter === 'unassigned'}
          onClick={() =>
            onAssigneeFilterChange(assigneeFilter === 'unassigned' ? 'all' : 'unassigned')
          }
        >
          Unassigned
        </FilterChip>
        <FilterChip active={activeOnlyFilter} onClick={onActiveOnlyToggle}>
          Active
          {openTicketCount > 0 ? (
            <SupportCountBadge
              count={openTicketCount}
              className="min-h-4 min-w-4 px-1 text-[9px]"
            />
          ) : null}
        </FilterChip>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full px-2 text-[10px] font-medium leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Reset filters"
          >
            <X className="size-3" />
            Reset
          </button>
        ) : null}
        {currentAdminId && !isSuperAdmin ? (
          <FilterChip
            active={assigneeFilter === 'me'}
            onClick={() => onAssigneeFilterChange(assigneeFilter === 'me' ? 'all' : 'me')}
          >
            Mine
          </FilterChip>
        ) : null}
        {isSuperAdmin && assigneeFilter === 'me' ? (
          <FilterChip
            active
            onClick={() => onAssigneeFilterChange('all')}
          >
            Mine
          </FilterChip>
        ) : null}
      </div>
    </div>
  );
}
