'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AdminActivityPagination from '@/components/AdminActivityPagination';
import AuditLogFilters from '@/components/AuditLogFilters';
import type { AuditSortOrder } from '@/lib/audit-query';
import {
  buildUnifiedCategoryOptions,
  UNIFIED_SOURCE_LABELS,
  UNIFIED_SOURCE_OPTIONS,
  type GroupedTimelineEntry,
  type UnifiedActivityRow,
} from '@/lib/unified-admin-activity';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  LayoutDashboard,
  LogIn,
  ScrollText,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function getCustomerDisplayLabel(opts: {
  name?: string;
  companyName?: string;
}): string {
  if (opts.name?.trim()) return opts.name.trim();
  if (opts.companyName?.trim()) return opts.companyName.trim();
  return '—';
}

function sanitizeSummaryForDisplay(summary: string): string {
  return summary
    .replace(/\s*\([^)]*@[^)]+\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatWhen(iso: string): { primary: string; full: string } {
  const date = new Date(iso);
  const full = date.toLocaleString();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (startOfDate.getTime() === startOfToday.getTime()) {
    return { primary: `Today ${time}`, full };
  }
  if (startOfDate.getTime() === startOfYesterday.getTime()) {
    return { primary: `Yesterday ${time}`, full };
  }

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return {
      primary: date.toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
      full,
    };
  }

  return {
    primary: date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }),
    full: `${full}`,
  };
}

function formatJsonBlock(data: unknown): string | null {
  if (data === null || data === undefined) return null;
  if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) {
    return null;
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function formatDetailLines(row: UnifiedActivityRow): string[] {
  const details = row.details;
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    lines.push(`${label}: ${String(value)}`);
  };

  if (row.source === 'public_circle') {
    if (row.metadata && typeof row.metadata.entityName === 'string') {
      push('Entity', row.metadata.entityName);
    }
    return lines;
  }

  if (!details || typeof details !== 'object') return lines;
  push('Previous status', details.previousStatus);
  push('New status', details.status);
  push('Subject', details.subject);
  push('Company', details.companyName);
  if (typeof details.impersonatedUserName === 'string') {
    push('Customer', details.impersonatedUserName);
  }
  push('Plan', details.planName);
  return lines;
}

function JsonBlock({ label, data }: { label: string; data: unknown }) {
  const formatted = formatJsonBlock(data);
  if (!formatted) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <ScrollArea className="max-h-52 w-full rounded-md border bg-muted/40">
        <pre className="p-3 text-[11px] leading-relaxed font-mono">{formatted}</pre>
      </ScrollArea>
    </div>
  );
}

function WhenCell({ iso, nested }: { iso: string; nested?: boolean }) {
  const when = formatWhen(iso);
  return (
    <div className={cn('flex items-start gap-2', nested && 'pl-4')}>
      {nested && (
        <span className="mt-1.5 h-full w-px min-h-[28px] bg-border shrink-0" aria-hidden />
      )}
      <time dateTime={iso} title={when.full} className="text-xs text-muted-foreground leading-5">
        {when.primary}
      </time>
    </div>
  );
}

function ActivityDetailCell({ row }: { row: UnifiedActivityRow }) {
  const detailLines = formatDetailLines(row);
  const isApiCall =
    row.source === 'public_circle' &&
    row.method &&
    row.path &&
    row.method !== 'SESSION' &&
    row.activityType !== 'SESSION_END';
  const requestPayload = row.requestBody;
  const queryParams = row.query;
  const panelPayload =
    row.source === 'admin_panel' && row.details && typeof row.details === 'object'
      ? row.details
      : null;

  const hasContent =
    detailLines.length > 0 ||
    isApiCall ||
    formatJsonBlock(requestPayload) ||
    formatJsonBlock(queryParams) ||
    (panelPayload && formatJsonBlock(panelPayload));

  if (!hasContent) return null;

  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 -ml-2 text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:rotate-90"
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform" />
          {isApiCall ? 'API details & logged data' : 'More detail'}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2 shadow-none">
          <CardContent className="space-y-3 p-3 text-xs text-muted-foreground">
            {isApiCall && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">API request</p>
                <code className="block rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-[11px] text-foreground break-all">
                  {row.method} {row.path}
                  {row.statusCode != null ? ` → ${row.statusCode}` : ''}
                </code>
              </div>
            )}
            {isApiCall && (
              <JsonBlock label="Logged request data (subset)" data={requestPayload} />
            )}
            {isApiCall && <JsonBlock label="Query parameters" data={queryParams} />}
            {!isApiCall && panelPayload && (
              <JsonBlock label="Change details" data={panelPayload} />
            )}
            {detailLines.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4">
                {detailLines.map((line) => (
                  <li key={line} className="leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SessionRecordsBadge({
  count,
  expanded,
  loadedCount,
}: {
  count: number;
  expanded?: boolean;
  loadedCount?: number;
}) {
  const displayCount =
    expanded && loadedCount !== undefined ? loadedCount : count;

  if (displayCount <= 0) {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        No actions
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="font-normal tabular-nums">
      {displayCount} record{displayCount === 1 ? '' : 's'}
    </Badge>
  );
}

function SourceBadge({ source }: { source: UnifiedActivityRow['source'] }) {
  const isPanel = source === 'admin_panel';
  return (
    <Badge variant={isPanel ? 'secondary' : 'outline'} className="gap-1 font-normal">
      {isPanel ? <LayoutDashboard className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
      {UNIFIED_SOURCE_LABELS[source]}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          {loading ? '—' : value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

type AdminActivityGroupedPanelProps = {
  adminEmail: string;
  adminName?: string;
};

export default function AdminActivityGroupedPanel({
  adminEmail,
}: AdminActivityGroupedPanelProps) {
  const [timeline, setTimeline] = useState<GroupedTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [panelTotal, setPanelTotal] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [pcActionTotal, setPcActionTotal] = useState(0);

  const [source, setSource] = useState('all');
  const [category, setCategory] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<AuditSortOrder>('desc');
  const [refreshKey, setRefreshKey] = useState(0);

  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [sessionActions, setSessionActions] = useState<Record<string, UnifiedActivityRow[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<Set<string>>(new Set());

  const categoryOptions = useMemo(() => buildUnifiedCategoryOptions(source), [source]);

  const sourceLabel = useMemo(
    () => UNIFIED_SOURCE_OPTIONS.find((opt) => opt.value === source)?.label,
    [source]
  );

  const groupedCategoryOptions = useMemo(() => {
    const groups = new Map<string, { value: string; label: string }[]>();
    for (const opt of categoryOptions) {
      if (!groups.has(opt.group)) groups.set(opt.group, []);
      groups.get(opt.group)!.push({ value: opt.value, label: opt.label });
    }
    return groups;
  }, [categoryOptions]);

  const categoryLabel = useMemo(
    () => categoryOptions.find((opt) => opt.value === category)?.label,
    [categoryOptions, category]
  );

  const sessionIdsOnPage = useMemo(
    () =>
      timeline
        .filter((entry): entry is Extract<GroupedTimelineEntry, { kind: 'session' }> => entry.kind === 'session')
        .map((entry) => entry.sessionId),
    [timeline]
  );

  const hasActiveFilters =
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    source !== 'all' ||
    category !== 'all' ||
    sort !== 'desc';

  const buildBaseParams = useCallback(() => {
    const params = new URLSearchParams({
      adminEmail,
      sort,
      hideNoise: 'true',
      grouped: '1',
      source,
    });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (category !== 'all') params.set('category', category);
    return params;
  }, [adminEmail, sort, source, dateFrom, dateTo, category]);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildBaseParams();
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/admin-unified-activities?${params}&_=${refreshKey}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);

      setTimeline(json.timeline ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotal(json.pagination?.total ?? 0);
      setPanelTotal(json.pagination?.panelTotal ?? 0);
      setSessionTotal(json.pagination?.sessionTotal ?? 0);
      setPcActionTotal(json.pagination?.publicCircleTotal ?? 0);
    } catch {
      setTimeline([]);
      setTotal(0);
      setTotalPages(1);
      setPanelTotal(0);
      setSessionTotal(0);
      setPcActionTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildBaseParams, page, limit, refreshKey]);

  useEffect(() => {
    setPage(1);
    setExpandedSessions(new Set());
    setSessionActions({});
  }, [adminEmail, dateFrom, dateTo, sort, source, category, limit]);

  useEffect(() => {
    if (category === 'all') return;
    const stillValid = categoryOptions.some((opt) => opt.value === category);
    if (!stillValid) setCategory('all');
  }, [category, categoryOptions]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  const loadSessionActions = useCallback(
    async (sessionId: string) => {
      setLoadingSessions((prev) => {
        if (prev.has(sessionId)) return prev;
        return new Set(prev).add(sessionId);
      });

      try {
        const params = buildBaseParams();
        params.delete('grouped');
        params.set('sessionId', sessionId);
        const res = await fetch(`/api/admin-unified-activities?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error);
        setSessionActions((prev) => {
          if (prev[sessionId]) return prev;
          return { ...prev, [sessionId]: json.activities ?? [] };
        });
      } catch {
        setSessionActions((prev) => ({ ...prev, [sessionId]: [] }));
      } finally {
        setLoadingSessions((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    },
    [buildBaseParams]
  );

  const toggleSession = useCallback(
    (sessionId: string) => {
      let shouldLoad = false;
      setExpandedSessions((prev) => {
        const next = new Set(prev);
        if (next.has(sessionId)) {
          next.delete(sessionId);
        } else {
          next.add(sessionId);
          shouldLoad = true;
        }
        return next;
      });
      if (shouldLoad && !sessionActions[sessionId]) {
        void loadSessionActions(sessionId);
      }
    },
    [loadSessionActions, sessionActions]
  );

  const expandAllSessions = useCallback(() => {
    setExpandedSessions(new Set(sessionIdsOnPage));
    for (const sessionId of sessionIdsOnPage) {
      if (!sessionActions[sessionId]) {
        void loadSessionActions(sessionId);
      }
    }
  }, [sessionIdsOnPage, sessionActions, loadSessionActions]);

  const collapseAllSessions = useCallback(() => {
    setExpandedSessions(new Set());
  }, []);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSource('all');
    setCategory('all');
    setSort('desc');
  };

  const handleRefresh = () => {
    setExpandedSessions(new Set());
    setSessionActions({});
    setRefreshKey((k) => k + 1);
  };

  const renderActivityRow = (row: UnifiedActivityRow, nested = false) => (
    <TableRow
      key={row.id}
      className={cn('group transition-colors', nested && 'bg-muted/30')}
    >
      <TableCell className={cn('align-top py-3', !nested && 'pl-6')}>
        <WhenCell iso={row.createdAt} nested={nested} />
      </TableCell>
      <TableCell className="align-top whitespace-normal min-w-[280px] py-3">
        <p className="text-sm leading-snug text-foreground">
          {sanitizeSummaryForDisplay(row.summary)}
        </p>
        <ActivityDetailCell row={row} />
      </TableCell>
      <TableCell className="align-top py-3">
        <SourceBadge source={row.source} />
      </TableCell>
      <TableCell className="align-top whitespace-normal py-3">
        <span className="text-xs text-foreground/80 truncate block max-w-[200px]">
          {getCustomerDisplayLabel({
            name:
              typeof row.details?.impersonatedUserName === 'string'
                ? row.details.impersonatedUserName
                : undefined,
            companyName:
              typeof row.metadata?.companyName === 'string'
                ? row.metadata.companyName
                : typeof row.details?.companyName === 'string'
                  ? row.details.companyName
                  : undefined,
          })}
        </span>
      </TableCell>
      <TableCell className="align-top py-3 pr-6">
        <Badge variant="outline" className="text-[10px] font-normal">
          {row.categoryLabel}
        </Badge>
      </TableCell>
    </TableRow>
  );

  const allSessionsExpanded =
    sessionIdsOnPage.length > 0 && sessionIdsOnPage.every((id) => expandedSessions.has(id));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Admin panel actions"
          value={panelTotal}
          loading={loading}
          icon={<LayoutDashboard className="h-4 w-4" />}
        />
        <StatCard
          label="Login sessions"
          value={sessionTotal}
          loading={loading}
          icon={<LogIn className="h-4 w-4" />}
        />
        <StatCard
          label="Public Circle actions"
          value={pcActionTotal}
          loading={loading}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      <AuditLogFilters
        showAdminEmail={false}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        sort={sort}
        onSortChange={setSort}
        onRefresh={handleRefresh}
        refreshing={loading}
        title="Filters"
        description="Narrow the timeline by source, date, and category."
      >
        <div className="space-y-2">
          <Label htmlFor="timeline-source-filter">Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger id="timeline-source-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIFIED_SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeline-category-filter">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="timeline-category-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from(groupedCategoryOptions.entries()).map(([group, opts]) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {opts.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </AuditLogFilters>

      {hasActiveFilters && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-foreground">Active filters</span>
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
          {dateFrom && (
            <Badge variant="secondary" className="gap-1 font-normal">
              From {dateFrom}
              <button type="button" onClick={() => setDateFrom('')} aria-label="Clear from date">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {dateTo && (
            <Badge variant="secondary" className="gap-1 font-normal">
              To {dateTo}
              <button type="button" onClick={() => setDateTo('')} aria-label="Clear to date">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {source !== 'all' && sourceLabel && (
            <Badge variant="secondary" className="gap-1 font-normal">
              Source: {sourceLabel}
              <button type="button" onClick={() => setSource('all')} aria-label="Clear source">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {category !== 'all' && categoryLabel && (
            <Badge variant="secondary" className="gap-1 font-normal">
              {categoryLabel}
              <button type="button" onClick={() => setCategory('all')} aria-label="Clear category">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {sort !== 'desc' && (
            <Badge variant="secondary" className="gap-1 font-normal">
              Oldest first
              <button type="button" onClick={() => setSort('desc')} aria-label="Reset sort">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
            Clear all
          </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Activity timeline</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading activity…'
                  : `${total.toLocaleString()} entries · expand a login session to see API payloads`}
              </CardDescription>
            </div>
            {source !== 'admin_panel' && sessionIdsOnPage.length > 0 && !loading && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={allSessionsExpanded ? collapseAllSessions : expandAllSessions}
              >
                {allSessionsExpanded ? (
                  <>
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                    Collapse sessions
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                    Expand all sessions
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[min(70vh,760px)]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[150px] pl-6">When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-[130px]">Source</TableHead>
                  <TableHead className="w-[160px]">Customer</TableHead>
                  <TableHead className="w-[140px] pr-6">Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="py-3">
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : timeline.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16">
                      <div className="flex flex-col items-center justify-center text-center gap-2">
                        <ScrollText className="h-10 w-10 text-muted-foreground/50" />
                        <p className="text-sm font-medium">No activity found</p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {hasActiveFilters
                            ? 'Try clearing filters or widening the date range.'
                            : 'This admin has not recorded any actions yet.'}
                        </p>
                        {hasActiveFilters && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 h-8"
                            onClick={clearFilters}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  timeline.map((entry) => {
                    if (entry.kind === 'activity') {
                      return renderActivityRow(entry.row);
                    }

                    const expanded = expandedSessions.has(entry.sessionId);
                    const actions = sessionActions[entry.sessionId];
                    const isLoadingSession = loadingSessions.has(entry.sessionId);
                    const loadedCount = actions?.length;
                    const recordCount =
                      expanded && loadedCount !== undefined ? loadedCount : entry.actionCount;
                    const hasRecords = recordCount > 0;
                    const customerLabel = getCustomerDisplayLabel({
                      name: entry.customerName,
                      companyName: entry.companyName,
                    });

                    return (
                      <Fragment key={entry.id}>
                        <TableRow
                          className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                          onClick={() => toggleSession(entry.sessionId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleSession(entry.sessionId);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-expanded={expanded}
                        >
                          <TableCell className="align-top py-3 pl-6">
                            <WhenCell iso={entry.createdAt} />
                          </TableCell>
                          <TableCell className="align-top whitespace-normal min-w-[280px] py-3">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-muted-foreground">
                                {expanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex items-center gap-1.5 text-sm font-medium leading-snug min-w-0">
                                    <LogIn className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span>{sanitizeSummaryForDisplay(entry.loginSummary)}</span>
                                  </div>
                                  <SessionRecordsBadge
                                    count={entry.actionCount}
                                    expanded={expanded}
                                    loadedCount={loadedCount}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {hasRecords
                                    ? expanded
                                      ? `Click to hide ${recordCount} nested record${recordCount === 1 ? '' : 's'}`
                                      : `Click to view ${recordCount} nested record${recordCount === 1 ? '' : 's'}`
                                    : 'No Public Circle actions in this session'}
                                  {entry.companyName && (
                                    <>
                                      {' '}
                                      · <Building2 className="inline h-3 w-3 -mt-px" />{' '}
                                      {entry.companyName}
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-3">
                            <Badge variant="secondary" className="font-normal">
                              Login session
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top py-3">
                            <span className="text-xs text-foreground/80 truncate block max-w-[200px]">
                              {customerLabel || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="align-top py-3 pr-6">
                            <div className="flex flex-col gap-1.5 items-start">
                              <Badge variant="outline" className="text-[10px] font-normal">
                                Impersonation
                              </Badge>
                              {hasRecords && !expanded && (
                                <span className="text-[10px] text-muted-foreground">
                                  Expand for details
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {expanded && isLoadingSession && (
                          <TableRow className="bg-muted/15">
                            <TableCell colSpan={5} className="py-4 pl-12">
                              <div className="space-y-2 max-w-xl">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}

                        {expanded && !isLoadingSession && actions && actions.length === 0 && (
                          <TableRow className="bg-muted/15">
                            <TableCell colSpan={5} className="py-3 pl-12 text-xs text-muted-foreground">
                              No Public Circle actions recorded for this session.
                            </TableCell>
                          </TableRow>
                        )}

                        {expanded && actions?.map((row) => renderActivityRow(row, true))}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <Separator />

          <div className="px-6 py-3">
            <AdminActivityPagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              loading={loading}
              compact={false}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
