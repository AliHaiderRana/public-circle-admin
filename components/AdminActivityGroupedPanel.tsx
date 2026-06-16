'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Archive,
  Building2,
  ChevronRight,
  LayoutDashboard,
  Loader2,
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

function getSessionCustomerLabel(entry: {
  customerName?: string;
  companyName?: string;
  customerEmail?: string;
}): string | null {
  const label = getCustomerDisplayLabel({
    name: entry.customerName,
    companyName: entry.companyName,
  });
  if (label !== '—') return label;
  if (entry.customerEmail?.trim()) return entry.customerEmail.trim();
  return null;
}

function isValidObjectId(value?: string | null): value is string {
  return Boolean(value && /^[a-f0-9]{24}$/i.test(value));
}

function resolveSessionCompany(
  entry: {
    companyId?: string;
    companyName?: string;
  } | null,
  actions?: UnifiedActivityRow[]
): { companyId: string; companyName?: string } | null {
  if (!entry) return null;

  if (isValidObjectId(entry.companyId)) {
    return { companyId: entry.companyId, companyName: entry.companyName };
  }

  const fromAction = actions?.find((row) => isValidObjectId(row.companyId));
  if (fromAction?.companyId) {
    const metadataCompany =
      typeof fromAction.metadata?.companyName === 'string'
        ? fromAction.metadata.companyName
        : undefined;
    return {
      companyId: fromAction.companyId,
      companyName: entry.companyName ?? metadataCompany,
    };
  }

  return null;
}

function formatSessionMetaLine(entry: {
  customerName?: string;
  companyName?: string;
  customerEmail?: string;
  actionCount: number;
}): string | null {
  const parts: string[] = [];
  const customer = getSessionCustomerLabel(entry);

  if (customer) parts.push(customer);
  if (
    entry.customerName?.trim() &&
    entry.companyName?.trim() &&
    entry.companyName.trim() !== customer
  ) {
    parts.push(entry.companyName.trim());
  }
  if (entry.actionCount > 0) {
    parts.push(
      `${entry.actionCount} record${entry.actionCount === 1 ? '' : 's'}`
    );
  }

  return parts.length > 0 ? parts.join(' · ') : null;
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
      primary: date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      full,
    };
  }

  return {
    primary: date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

function SessionRecordsBadge({ count }: { count: number }) {
  if (count <= 0) {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        No actions
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="font-normal tabular-nums">
      {count} record{count === 1 ? '' : 's'}
    </Badge>
  );
}

type GroupedTimelineSessionEntry = Extract<GroupedTimelineEntry, { kind: 'session' }>;
type ArchivedWarehouseSummary = {
  totalStored: number;
  panelStored: number;
  publicCircleStored: number;
  panelArchivedAt: string | null;
  publicCircleArchivedAt: string | null;
};

function ActivityTableHeader({ hideSourceAndCustomer = false }: { hideSourceAndCustomer?: boolean }) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="w-[150px] pl-6">When</TableHead>
        <TableHead>Action</TableHead>
        {!hideSourceAndCustomer && (
          <>
            <TableHead className="w-[130px]">Source</TableHead>
            <TableHead className="w-[160px]">Customer</TableHead>
          </>
        )}
        <TableHead className="w-[140px] pr-6">Category</TableHead>
      </TableRow>
    </TableHeader>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1.5">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="text-xl font-bold tabular-nums">
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
  const [controlsOpen, setControlsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'live' | 'archived'>('live');
  const [timeline, setTimeline] = useState<GroupedTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
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

  const [sessionModal, setSessionModal] = useState<GroupedTimelineSessionEntry | null>(null);
  const [sessionActions, setSessionActions] = useState<Record<string, UnifiedActivityRow[]>>({});
  const [loadingSessions, setLoadingSessions] = useState<Set<string>>(new Set());
  const [archiveMonth, setArchiveMonth] = useState('');
  const [archivedRows, setArchivedRows] = useState<UnifiedActivityRow[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [archivedLoadedOnce, setArchivedLoadedOnce] = useState(false);
  const [archivedSummary, setArchivedSummary] = useState<ArchivedWarehouseSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

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
    setSessionModal(null);
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

  useEffect(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setArchiveMonth(month);
  }, []);

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
        const activities = (json.activities ?? []) as UnifiedActivityRow[];
        setSessionActions((prev) => {
          if (prev[sessionId]) return prev;
          return { ...prev, [sessionId]: activities };
        });
        const company = resolveSessionCompany(null, activities);
        if (company) {
          setSessionModal((prev) =>
            prev?.sessionId === sessionId
              ? {
                  ...prev,
                  companyId: prev.companyId ?? company.companyId,
                  companyName: prev.companyName ?? company.companyName,
                }
              : prev
          );
        }
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

  const openSessionModal = useCallback(
    (entry: GroupedTimelineSessionEntry) => {
      setSessionModal(entry);
      if (!sessionActions[entry.sessionId]) {
        void loadSessionActions(entry.sessionId);
      }
    },
    [loadSessionActions, sessionActions]
  );

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSource('all');
    setCategory('all');
    setSort('desc');
  };

  const loadArchivedRows = useCallback(async (monthOverride?: string) => {
    const monthToLoad = monthOverride ?? archiveMonth;
    if (!monthToLoad) {
      setArchivedError('Select a month first (YYYY-MM).');
      return;
    }
    setArchivedLoading(true);
    setArchivedError(null);
    setArchivedLoadedOnce(true);
    try {
      const params = new URLSearchParams({
        month: monthToLoad,
        source,
        category,
      });
      if (adminEmail) params.set('adminEmail', adminEmail);
      const res = await fetch(`/api/admin-unified-activities/archived?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load archived activity');
      setArchivedRows((json.activities ?? []) as UnifiedActivityRow[]);
    } catch (err) {
      setArchivedRows([]);
      setArchivedError(err instanceof Error ? err.message : 'Failed to load archived activity');
    } finally {
      setArchivedLoading(false);
    }
  }, [archiveMonth, source, category, adminEmail]);

  const fetchArchivedSummary = useCallback(async (monthOverride?: string) => {
    const monthToLoad = monthOverride ?? archiveMonth;
    if (!monthToLoad) {
      setArchivedSummary(null);
      return;
    }
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams({
        month: monthToLoad,
        source,
        category,
        summaryOnly: '1',
      });
      if (adminEmail) params.set('adminEmail', adminEmail);
      const res = await fetch(`/api/admin-unified-activities/archived?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load archive summary');
      setArchivedSummary((json.summary ?? null) as ArchivedWarehouseSummary | null);
    } catch {
      setArchivedSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [archiveMonth, source, category, adminEmail]);

  useEffect(() => {
    if (!archiveMonth) {
      setArchivedSummary(null);
      return;
    }
    void fetchArchivedSummary();
  }, [archiveMonth, source, category, adminEmail, fetchArchivedSummary]);

  const handleRefresh = () => {
    setSessionModal(null);
    setSessionActions({});
    setRefreshKey((k) => k + 1);
  };

  const modalSessionId = sessionModal?.sessionId ?? '';
  const modalActions = modalSessionId ? sessionActions[modalSessionId] : undefined;
  const modalLoading = modalSessionId ? loadingSessions.has(modalSessionId) : false;
  const sessionMetaLine = sessionModal ? formatSessionMetaLine(sessionModal) : null;
  const modalCompany = useMemo(
    () => resolveSessionCompany(sessionModal, modalActions),
    [sessionModal, modalActions]
  );

  const renderActivityRow = (
    row: UnifiedActivityRow,
    opts: { nested?: boolean; hideSourceAndCustomer?: boolean } = {}
  ) => {
    const { nested = false, hideSourceAndCustomer = false } = opts;

    return (
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
        {!hideSourceAndCustomer && (
          <>
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
          </>
        )}
        <TableCell className="align-top py-3 pr-6">
          <Badge variant="outline" className="text-[10px] font-normal">
            {row.categoryLabel}
          </Badge>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

      <Collapsible open={controlsOpen} onOpenChange={setControlsOpen}>
        <Card>
          <CardHeader className="py-1.5 px-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full h-8 justify-between px-1 text-sm">
                <span className="font-medium">Filters & Archived Data</span>
                <ChevronRight className={cn('h-4 w-4 transition-transform', controlsOpen && 'rotate-90')} />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
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

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-2">
                    <Archive className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">Archived Data Explorer</CardTitle>
                      <CardDescription>
                        Records older than 6 months move to warehouse storage by month and may take a few seconds to load.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="timeline-archive-month">Archived month</Label>
                      <Input
                        id="timeline-archive-month"
                        type="month"
                        value={archiveMonth}
                        onChange={(e) => {
                          const next = e.target.value;
                          setArchiveMonth(next);
                          setArchivedError(null);
                          if (!next) {
                            setArchivedRows([]);
                            setArchivedLoadedOnce(false);
                            setArchivedSummary(null);
                            setViewMode('live');
                            return;
                          }
                          void fetchArchivedSummary(next);
                          void loadArchivedRows(next);
                          setViewMode('archived');
                        }}
                        className="h-9 w-full sm:w-[240px]"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadArchivedRows()}
                      disabled={archivedLoading || !archiveMonth}
                      className="shrink-0"
                    >
                      {archivedLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Reload archived data'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setViewMode((prev) => (prev === 'live' ? 'archived' : 'live'))}
                      disabled={!archivedLoadedOnce && viewMode === 'live'}
                    >
                      {viewMode === 'live' ? 'View archived data' : 'View live timeline'}
                    </Button>
                  </div>

                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {summaryLoading ? (
                      <span>Checking warehouse summary...</span>
                    ) : archivedSummary ? (
                      <span>
                        Stored for {archiveMonth}: {archivedSummary.totalStored.toLocaleString()} rows
                        {' '}({archivedSummary.panelStored.toLocaleString()} admin panel,{' '}
                        {archivedSummary.publicCircleStored.toLocaleString()} Public Circle)
                      </span>
                    ) : (
                      <span>Select a month to see what is stored in warehouse.</span>
                    )}
                  </div>

                  {archivedError && (
                    <p className="text-xs text-red-600">{archivedError}</p>
                  )}
                </CardContent>
              </Card>

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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                {viewMode === 'live' ? 'Activity timeline' : `Archived activity (${archiveMonth || 'Select month'})`}
              </CardTitle>
              <CardDescription>
                {viewMode === 'live'
                  ? (loading
                      ? 'Loading activity…'
                      : `${total.toLocaleString()} entries · open a login session to view Public Circle actions`)
                  : (archivedLoading
                      ? 'Loading archived rows...'
                      : `${archivedRows.length.toLocaleString()} row${archivedRows.length === 1 ? '' : 's'} loaded from warehouse`)}
              </CardDescription>
            </div>
            <div className="inline-flex rounded-md border bg-muted/30 p-1 w-fit">
              <Button
                size="sm"
                variant={viewMode === 'live' ? 'secondary' : 'ghost'}
                className="h-7"
                onClick={() => setViewMode('live')}
              >
                Live timeline
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'archived' ? 'secondary' : 'ghost'}
                className="h-7"
                onClick={() => setViewMode('archived')}
                disabled={!archiveMonth}
              >
                Archived data
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[min(70vh,760px)]">
            <Table>
              <ActivityTableHeader />
              <TableBody>
                {viewMode === 'live' ? (
                  loading ? (
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

                      const recordCount = entry.actionCount;
                      const hasRecords = recordCount > 0;
                      const customerLabel = getSessionCustomerLabel(entry) ?? '—';

                      return (
                        <TableRow
                          key={entry.id}
                          className="group cursor-pointer bg-muted/40 hover:bg-muted/60"
                          onClick={() => openSessionModal(entry)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openSessionModal(entry);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-haspopup="dialog"
                          aria-label={
                            hasRecords
                              ? `View login session, ${recordCount} Public Circle action${recordCount === 1 ? '' : 's'}`
                              : 'View login session, no Public Circle actions'
                          }
                        >
                          <TableCell className="align-top py-3 pl-6">
                            <WhenCell iso={entry.createdAt} />
                          </TableCell>
                          <TableCell className="align-top whitespace-normal min-w-[280px] py-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium leading-snug text-foreground">
                                  {sanitizeSummaryForDisplay(entry.loginSummary)}
                                </span>
                                <SessionRecordsBadge count={entry.actionCount} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground/80">
                                {hasRecords
                                  ? `View ${recordCount} Public Circle action${recordCount === 1 ? '' : 's'}`
                                  : 'No Public Circle actions in this session'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-3">
                            <Badge variant="secondary" className="font-normal">
                              Login session
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top py-3">
                            <span className="text-xs text-foreground/80 truncate block max-w-[200px]">
                              {customerLabel}
                            </span>
                          </TableCell>
                          <TableCell className="align-top py-3 pr-6">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              Impersonation
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )
                ) : archivedLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={`archived-skeleton-${i}`}>
                      <TableCell colSpan={5} className="py-3">
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !archivedLoadedOnce ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      Select a month in Archived Data Explorer to load warehouse records.
                    </TableCell>
                  </TableRow>
                ) : archivedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No archived rows found for this month and filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  archivedRows.map((row) => renderActivityRow(row))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {viewMode === 'live' && (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={sessionModal !== null}
        onOpenChange={(open) => {
          if (!open) setSessionModal(null);
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,900px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="space-y-3 border-b px-6 py-4 pr-14 text-left">
            <DialogTitle>Public Circle session actions</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {sessionModal && (
                  <>
                    <p>{sanitizeSummaryForDisplay(sessionModal.loginSummary)}</p>
                    {sessionMetaLine && <p>{sessionMetaLine}</p>}
                  </>
                )}
              </div>
            </DialogDescription>
            {modalCompany && (
              <Button variant="outline" size="sm" className="h-8 w-fit text-xs" asChild>
                <Link
                  href={`/dashboard/companies/${modalCompany.companyId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Building2 className="size-3.5 mr-1.5" />
                  View company
                  {modalCompany.companyName ? `: ${modalCompany.companyName}` : ''}
                </Link>
              </Button>
            )}
          </DialogHeader>

          <ScrollArea className="h-[min(60vh,640px)]">
            <Table>
              <ActivityTableHeader hideSourceAndCustomer />
              <TableBody>
                {modalLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={3} className="py-3">
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : modalActions && modalActions.length > 0 ? (
                  modalActions.map((row) => renderActivityRow(row, { hideSourceAndCustomer: true }))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                      No Public Circle actions recorded for this session.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
