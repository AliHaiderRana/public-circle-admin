'use client';

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type CompanyOption = {
  _id: string;
  name: string;
};

type CompanyComboboxProps = {
  value: string;
  onChange: (companyId: string, companyName: string | null) => void;
  selectedLabel?: string | null;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 30;

export function CompanyCombobox({
  value,
  onChange,
  selectedLabel,
  placeholder = 'All companies',
  className,
  triggerClassName,
  pageSize = DEFAULT_PAGE_SIZE,
}: CompanyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPage = useCallback(
    async (pageNum: number, search: string, append: boolean) => {
      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        loadingMoreRef.current = false;
        setLoadingMore(false);
        setLoading(true);
      }

      const requestId = ++requestIdRef.current;

      try {
        const qs = new URLSearchParams({
          page: String(pageNum),
          limit: String(pageSize),
          sort: 'asc',
          sortBy: 'name',
        });
        if (search) qs.set('search', search);

        const res = await fetch(`/api/companies?${qs.toString()}`);
        const json = await res.json();
        if (requestId !== requestIdRef.current) return;
        if (!res.ok) throw new Error(json?.error || 'Failed to load companies');

        const list = ((json.companies ?? []) as CompanyOption[])
          .filter((c) => c?._id)
          .map((c) => ({
            _id: String(c._id),
            name: (c.name || '').trim() || 'Unnamed company',
          }));

        const totalPages = Math.max(1, Number(json.pagination?.pages) || 1);
        setCompanies((prev) => {
          if (!append) return list;
          const seen = new Set(prev.map((c) => c._id));
          return [...prev, ...list.filter((c) => !seen.has(c._id))];
        });
        setPage(pageNum);
        setHasMore(pageNum < totalPages);
      } catch {
        if (requestId !== requestIdRef.current) return;
        if (!append) {
          setCompanies([]);
          setHasMore(false);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
        if (append) loadingMoreRef.current = false;
      }
    },
    [pageSize]
  );

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setHasMore(true);
    void fetchPage(1, searchTerm, false);
  }, [open, searchTerm, fetchPage]);

  useEffect(() => {
    if (!open) {
      setSearchInput('');
      setSearchTerm('');
    }
  }, [open]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    if (nearBottom && hasMore && !loading && !loadingMore) {
      void fetchPage(page + 1, searchTerm, true);
    }
  };

  const displayLabel =
    value && (selectedLabel || companies.find((c) => c._id === value)?.name)
      ? selectedLabel || companies.find((c) => c._id === value)?.name
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-8 w-[220px] justify-between px-2.5 text-xs font-normal',
            triggerClassName,
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {value ? (
              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            ) : null}
            <span className="truncate">{displayLabel}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] max-w-[220px] overflow-hidden p-0"
        align="end"
      >
        <Command shouldFilter={false} className="w-full overflow-hidden">
          <CommandInput
            placeholder="Search by name or ID..."
            value={searchInput}
            onValueChange={setSearchInput}
          />
          <CommandList onScroll={handleScroll} className="max-h-[260px] overflow-x-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                <CommandEmpty>No company found</CommandEmpty>
                <CommandGroup className="overflow-hidden">
                  {!searchTerm && (
                    <CommandItem
                      value="__all__"
                      className="min-w-0 overflow-hidden"
                      onSelect={() => {
                        onChange('', null);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'size-3.5 shrink-0',
                          value ? 'opacity-0' : 'opacity-100'
                        )}
                      />
                      <span className="min-w-0 truncate">All companies</span>
                    </CommandItem>
                  )}
                  {companies.map((company) => (
                    <CommandItem
                      key={company._id}
                      value={`${company.name} ${company._id}`}
                      className="min-w-0 overflow-hidden"
                      onSelect={() => {
                        onChange(company._id, company.name);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'size-3.5 shrink-0',
                          value === company._id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 overflow-hidden">
                        <span className="block truncate">{company.name}</span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {company._id}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {loadingMore && (
                  <div className="flex items-center justify-center gap-2 border-t py-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading more…
                  </div>
                )}
                {!loadingMore && hasMore && companies.length > 0 && (
                  <div className="border-t py-2 text-center text-[11px] text-muted-foreground">
                    Scroll for more
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
