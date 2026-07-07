'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DlqMessageDetail } from '@/app/api/dlq/route';

const PAGE_SIZES = [10, 25, 50, 100] as const;

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function shortId(value: string | null) {
  if (!value) return '—';
  return value.length > 10 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

type RunSection = {
  companyId: string | null;
  companyName: string;
  campaignId: string | null;
  campaignName: string;
  campaignRunId: string | null;
  campaignRunStartedAt: string | null;
  messages: DlqMessageDetail[];
};

function groupByRun(messages: DlqMessageDetail[]): RunSection[] {
  const map = new Map<string, RunSection>();

  for (const message of messages) {
    const key = message.campaignRunId || '__unknown__';
    if (!map.has(key)) {
      map.set(key, {
        companyId: message.companyId,
        companyName: message.companyName || 'Unknown company',
        campaignId: message.campaignId,
        campaignName: message.campaignName || 'Unknown campaign',
        campaignRunId: message.campaignRunId,
        campaignRunStartedAt: message.campaignRunStartedAt,
        messages: [],
      });
    }
    map.get(key)!.messages.push(message);
  }

  return [...map.values()]
    .sort((a, b) => {
      const aDate = a.campaignRunStartedAt || '';
      const bDate = b.campaignRunStartedAt || '';
      return bDate.localeCompare(aDate);
    })
    .map((section) => ({
      ...section,
      messages: [...section.messages].sort((a, b) =>
        (a.emailTo || '').localeCompare(b.emailTo || ''),
      ),
    }));
}

function filterMessages(messages: DlqMessageDetail[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return messages;
  return messages.filter((row) =>
    [
      row.emailTo,
      row.emailSubject,
      row.companyName,
      row.campaignName,
      row.campaignRunId,
      row.failureReason,
      row.messageId,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

function ContextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn('text-foreground hover:underline underline-offset-2', className)}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}

function RunNavLinks({ section }: { section: RunSection }) {
  const links = [
    section.companyId
      ? { href: `/dashboard/companies/${section.companyId}`, label: 'Company' }
      : null,
    section.campaignId
      ? { href: `/dashboard/campaigns/${section.campaignId}`, label: 'Campaign' }
      : null,
    section.campaignRunId
      ? { href: `/dashboard/campaign-runs/${section.campaignRunId}`, label: 'Campaign run' }
      : null,
  ].filter(Boolean) as { href: string; label: string }[];

  if (!links.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map(({ href, label }) => (
        <Button key={href} asChild variant="outline" size="sm" className="h-7 text-xs">
          <Link href={href}>
            {label}
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      ))}
    </div>
  );
}

function MessageTable({
  rows,
  maxRetriesBeforeDlq,
  expandedIds,
  onToggleRow,
  showContext = true,
}: {
  rows: DlqMessageDetail[];
  maxRetriesBeforeDlq?: number | null;
  expandedIds: Set<string>;
  onToggleRow: (id: string) => void;
  showContext?: boolean;
}) {
  const colSpan = showContext ? 8 : 5;

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-8" />
          <TableHead>Recipient</TableHead>
          {showContext && (
            <>
              <TableHead>Company</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Run</TableHead>
            </>
          )}
          <TableHead className="w-20 text-center">Tries</TableHead>
          <TableHead className="hidden sm:table-cell w-36">Failed</TableHead>
          <TableHead>Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const expanded = expandedIds.has(row.messageId);
          const failureText = row.failureReason || 'No failure reason recorded.';
          const attempts =
            typeof row.deliveryAttempts === 'number' && row.deliveryAttempts > 0
              ? `${row.deliveryAttempts}${maxRetriesBeforeDlq ? `/${maxRetriesBeforeDlq}` : ''}`
              : '—';

          return (
            <Fragment key={row.messageId}>
              <TableRow
                className={cn('cursor-pointer', expanded && 'bg-muted/30')}
                onClick={() => onToggleRow(row.messageId)}
              >
                <TableCell className="py-2.5">
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      expanded && 'rotate-180',
                    )}
                  />
                </TableCell>
                <TableCell className="py-2.5">
                  <p className="font-medium text-sm">{row.emailTo || 'Unknown'}</p>
                  {row.emailSubject && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {row.emailSubject}
                    </p>
                  )}
                </TableCell>
                {showContext && (
                  <>
                    <TableCell className="py-2.5 text-sm">
                      {row.companyId ? (
                        <ContextLink href={`/dashboard/companies/${row.companyId}`}>
                          {row.companyName || shortId(row.companyId)}
                        </ContextLink>
                      ) : (
                        row.companyName || '—'
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm">
                      {row.campaignId ? (
                        <ContextLink href={`/dashboard/campaigns/${row.campaignId}`}>
                          {row.campaignName || shortId(row.campaignId)}
                        </ContextLink>
                      ) : (
                        row.campaignName || '—'
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm font-mono text-xs">
                      {row.campaignRunId ? (
                        <ContextLink href={`/dashboard/campaign-runs/${row.campaignRunId}`}>
                          {shortId(row.campaignRunId)}
                        </ContextLink>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell className="py-2.5 text-center text-sm tabular-nums">{attempts}</TableCell>
                <TableCell className="py-2.5 hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(row.lastFailedAt) || formatDate(row.queuedAt)}
                </TableCell>
                <TableCell className="py-2.5">
                  <p className="text-sm text-red-700 dark:text-red-400 line-clamp-1" title={failureText}>
                    {failureText}
                  </p>
                </TableCell>
              </TableRow>
              {expanded && (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={colSpan} className="py-3 px-6">
                    <p className="text-sm text-red-800 dark:text-red-300">{failureText}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {row.failureStatusCode != null && <span>HTTP {row.failureStatusCode}</span>}
                      {row.messageId && <span className="font-mono">SQS {shortId(row.messageId)}</span>}
                      {typeof row.index === 'number' && <span>Index {row.index}</span>}
                    </div>
                    <div className="mt-3">
                      <RunNavLinks
                        section={{
                          companyId: row.companyId,
                          companyName: row.companyName || '',
                          campaignId: row.campaignId,
                          campaignName: row.campaignName || '',
                          campaignRunId: row.campaignRunId,
                          campaignRunStartedAt: row.campaignRunStartedAt,
                          messages: [],
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function RunPagination({
  runKey,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  runKey: string;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-2 border-t px-3 py-2 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
      <p className="text-xs text-muted-foreground">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="h-8 w-16" aria-label={`Page size for run ${runKey}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="inline-flex items-center rounded-md border bg-background">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3.5rem] text-center text-xs tabular-nums">
            {page}/{totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function RunSectionBlock({
  section,
  maxRetriesBeforeDlq,
  expandedIds,
  onToggleRow,
}: {
  section: RunSection;
  maxRetriesBeforeDlq?: number | null;
  expandedIds: Set<string>;
  onToggleRow: (id: string) => void;
}) {
  const runKey = section.campaignRunId || section.campaignName;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const total = section.messages.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return section.messages.slice(start, start + pageSize);
  }, [section.messages, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <RunNavLinks section={section} />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {total} failed
        </span>
      </div>
      <div className="rounded-md border overflow-hidden">
        <MessageTable
          rows={pageRows}
          maxRetriesBeforeDlq={maxRetriesBeforeDlq}
          expandedIds={expandedIds}
          onToggleRow={onToggleRow}
          showContext={false}
        />
        <RunPagination
          runKey={runKey}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}

function GroupedByRunView({
  messages,
  maxRetriesBeforeDlq,
  expandedIds,
  onToggleRow,
}: {
  messages: DlqMessageDetail[];
  maxRetriesBeforeDlq?: number | null;
  expandedIds: Set<string>;
  onToggleRow: (id: string) => void;
}) {
  const sections = useMemo(() => groupByRun(messages), [messages]);

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const key = section.campaignRunId || section.campaignName;
        return (
          <RunSectionBlock
            key={key}
            section={section}
            maxRetriesBeforeDlq={maxRetriesBeforeDlq}
            expandedIds={expandedIds}
            onToggleRow={onToggleRow}
          />
        );
      })}
    </div>
  );
}

export type DlqFailedMessagesPanelProps = {
  messages: DlqMessageDetail[];
  totalInDlq: number | null;
  messagesInFlight?: number;
  peekComplete?: boolean;
  maxRetriesBeforeDlq?: number | null;
  onRetryLoad?: () => void;
  retrying?: boolean;
};

export default function DlqFailedMessagesPanel({
  messages,
  totalInDlq,
  messagesInFlight = 0,
  peekComplete = true,
  maxRetriesBeforeDlq,
  onRetryLoad,
  retrying = false,
}: DlqFailedMessagesPanelProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => filterMessages(messages, search), [messages, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    if (viewMode === 'grouped') return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, viewMode]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const stats = useMemo(() => {
    const companies = new Set(filtered.map((m) => m.companyId || m.companyName)).size;
    const runs = new Set(filtered.map((m) => m.campaignRunId)).size;
    return { companies, runs };
  }, [filtered]);

  const toggleRow = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const available = totalInDlq ?? 0;
  const inFlight = messagesInFlight ?? 0;
  const showInFlightNotice = inFlight > 0;

  return (
    <div className="space-y-5">
      {showInFlightNotice && (
        <div className="flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>{inFlight}</strong> message{inFlight === 1 ? '' : 's'} in flight in SQS — temporarily
              hidden while being read. Wait ~30 seconds, then refresh.
            </span>
          </div>
          {onRetryLoad && (
            <Button type="button" variant="outline" size="sm" onClick={onRetryLoad} disabled={retrying}>
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', retrying && 'animate-spin')} />
              Refresh
            </Button>
          )}
        </div>
      )}

      {!peekComplete && !showInFlightNotice && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Could not load all messages yet. Try refreshing in a few seconds.</span>
          </div>
          {onRetryLoad && (
            <Button type="button" variant="outline" size="sm" onClick={onRetryLoad} disabled={retrying}>
              <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', retrying && 'animate-spin')} />
              Refresh
            </Button>
          )}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{available}</span> available
        {' · '}
        <span className={cn('tabular-nums', inFlight > 0 && 'text-blue-700 font-medium')}>
          {inFlight} in flight
        </span>
        {' · '}
        <span className="tabular-nums">{stats.companies}</span> {stats.companies === 1 ? 'company' : 'companies'}
        {' · '}
        <span className="tabular-nums">{stats.runs}</span> {stats.runs === 1 ? 'run' : 'runs'}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search email, company, campaign…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9"
          />
        </div>
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'grouped' | 'flat')}>
          <SelectTrigger className="w-[9rem] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grouped">By run</SelectItem>
            <SelectItem value="flat">All rows</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No messages match your search.</p>
      ) : viewMode === 'grouped' ? (
        <GroupedByRunView
          messages={paginated}
          maxRetriesBeforeDlq={maxRetriesBeforeDlq}
          expandedIds={expandedIds}
          onToggleRow={toggleRow}
        />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <MessageTable
            rows={paginated}
            maxRetriesBeforeDlq={maxRetriesBeforeDlq}
            expandedIds={expandedIds}
            onToggleRow={toggleRow}
          />
        </div>
      )}

      {filtered.length > 0 && viewMode === 'flat' && (
        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
            {search ? ` matching “${search.trim()}”` : ''}
          </p>
          {filtered.length > PAGE_SIZES[0] && (
            <div className="flex items-center gap-2">
              <Label htmlFor="dlq-page-size" className="text-xs text-muted-foreground sr-only">
                Per page
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger id="dlq-page-size" className="h-8 w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="inline-flex items-center rounded-md border">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[4rem] text-center text-xs tabular-nums">
                  {page}/{totalPages}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}