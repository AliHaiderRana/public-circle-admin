'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getLiveActivityStartDate, type AuditSortOrder } from '@/lib/audit-query';
import {
  buildUnifiedCategoryOptions,
  UNIFIED_SOURCE_LABELS,
  UNIFIED_SOURCE_OPTIONS,
  type GroupedTimelineEntry,
  type UnifiedActivityRow,
} from '@/lib/unified-admin-activity';
import { ADMIN_ACTIVITY_WAREHOUSE_RETENTION_MONTHS } from '@/lib/admin-audit.constants';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronRight,
  Database,
  Filter,
  LayoutDashboard,
  RefreshCw,
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

function ActivityTableHeader({ hideSourceAndCustomer = false }: { hideSourceAndCustomer?: boolean }) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="w-[130px] pl-4">When</TableHead>
        <TableHead>Action</TableHead>
        {!hideSourceAndCustomer && (
          <>
            <TableHead className="w-[120px]">Source</TableHead>
            <TableHead className="w-[140px]">Customer</TableHead>
          </>
        )}
        <TableHead className="w-[120px] pr-4">Category</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function CompactStat({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <span className="text-sm whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>{' '}
      <span className="font-semibold tabular-nums">{loading ? '—' : value.toLocaleString()}</span>
    </span>
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

function ActorTypeBadge({ row }: { row: UnifiedActivityRow }) {
  if (row.actorIsPartner) {
    const label =
      row.referralRole === 'SALES_PERSON'
        ? 'Sales partner'
        : row.referralRole === 'MARKETING_AFFILIATE'
          ? 'Marketing partner'
          : 'Support partner';
    return (
      <Badge variant="outline" className="gap-1 font-normal">
        {label}
      </Badge>
    );
  }
  if (row.actorWasSuperAdmin) {
    return (
      <Badge className="gap-1 font-normal">
        <ShieldAlert className="h-3 w-3" />
        Super admin
      </Badge>
    );
  }
  if (row.source === 'admin_panel') {
    return <Badge variant="secondary" className="font-normal">Support admin</Badge>;
  }
  return null;
}

type AdminActivityGroupedPanelProps = {
  adminEmail: string;
  adminName?: string;
};

export default function AdminActivityGroupedPanel({
  adminEmail,
  adminName = '',
}: AdminActivityGroupedPanelProps) {
  const [controlsOpen, setControlsOpen] = useState(false);
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

  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [warehouseRows, setWarehouseRows] = useState<UnifiedActivityRow[]>([]);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [warehouseProgress, setWarehouseProgress] = useState({ loaded: 0, total: 0 });
  const [warehousePage, setWarehousePage] = useState(1);
  const [warehouseLimit, setWarehouseLimit] = useState(25);
  const warehouseFetchToken = useRef<{ cancelled: boolean } | null>(null);

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

  // First day still in the live DB — everything before this lives only in the S3 warehouse.
  const liveStartDate = useMemo(
    () => getLiveActivityStartDate(ADMIN_ACTIVITY_WAREHOUSE_RETENTION_MONTHS),
    []
  );
  const liveStartDateLabel = useMemo(
    () =>
      new Date(`${liveStartDate}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [liveStartDate]
  );

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

  // Warehouse modal: list existing archive months, then fetch them in small batches
  // so we can show real progress and render rows as they arrive.
  const loadWarehouse = useCallback(async () => {
    const token = { cancelled: false };
    warehouseFetchToken.current = token;
    setWarehouseLoading(true);
    setWarehouseError(null);
    setWarehouseRows([]);
    setWarehousePage(1);
    setWarehouseProgress({ loaded: 0, total: 0 });

    try {
      const listRes = await fetch('/api/admin-unified-activities/archived?listMonths=1');
      const listJson = await listRes.json();
      if (!listRes.ok) throw new Error(listJson?.error || 'Failed to list archive months');
      if (token.cancelled) return;

      const months: string[] = [...(listJson.months ?? [])].sort();
      if (sort === 'desc') months.reverse();
      setWarehouseProgress({ loaded: 0, total: months.length });

      const BATCH = 4;
      const collected: UnifiedActivityRow[] = [];
      for (let i = 0; i < months.length; i += BATCH) {
        if (token.cancelled) return;
        const batch = months.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async (month) => {
            const params = new URLSearchParams({ month, source, category, sort });
            if (adminEmail) params.set('adminEmail', adminEmail);
            const res = await fetch(`/api/admin-unified-activities/archived?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || `Failed to load archive for ${month}`);
            return (json.activities ?? []) as UnifiedActivityRow[];
          })
        );
        if (token.cancelled) return;
        collected.push(...results.flat());
        setWarehouseRows([...collected]);
        setWarehouseProgress({ loaded: Math.min(i + BATCH, months.length), total: months.length });
      }
    } catch (err) {
      if (!token.cancelled) {
        setWarehouseError(err instanceof Error ? err.message : 'Failed to load warehouse data');
      }
    } finally {
      if (!token.cancelled) setWarehouseLoading(false);
    }
  }, [source, category, sort, adminEmail]);

  const openWarehouseModal = useCallback(() => {
    setWarehouseOpen(true);
    void loadWarehouse();
  }, [loadWarehouse]);

  const closeWarehouseModal = useCallback(() => {
    if (warehouseFetchToken.current) warehouseFetchToken.current.cancelled = true;
    setWarehouseOpen(false);
    setWarehouseLoading(false);
  }, []);

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

  const warehouseTotalPages = useMemo(
    () => Math.max(1, Math.ceil(warehouseRows.length / warehouseLimit)),
    [warehouseRows.length, warehouseLimit]
  );

  const paginatedWarehouseRows = useMemo(() => {
    const start = (warehousePage - 1) * warehouseLimit;
    return warehouseRows.slice(start, start + warehouseLimit);
  }, [warehouseRows, warehousePage, warehouseLimit]);

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
        <TableCell className={cn('align-top py-2', !nested && 'pl-4')}>
          <WhenCell iso={row.createdAt} nested={nested} />
        </TableCell>
        <TableCell className="align-top whitespace-normal min-w-0 py-2">
          <p className="text-sm leading-snug text-foreground">
            {sanitizeSummaryForDisplay(row.summary)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <ActorTypeBadge row={row} />
          </div>
          <ActivityDetailCell row={row} />
        </TableCell>
        {!hideSourceAndCustomer && (
          <>
            <TableCell className="align-top py-2">
              <SourceBadge source={row.source} />
            </TableCell>
            <TableCell className="align-top whitespace-normal py-2">
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
        <TableCell className="align-top py-2 pr-4">
          <Badge variant="outline" className="text-xs font-normal">
            {row.categoryLabel}
          </Badge>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb row with refresh on the right */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 h-8" asChild>
            <Link href="/dashboard/admins">
              <ArrowLeft className="h-4 w-4" />
              Admin Users
            </Link>
          </Button>
          <span className="hidden sm:inline text-muted-foreground">/</span>
          <h1 className="text-xl font-semibold tracking-tight">View activity</h1>
          <span className="text-sm text-muted-foreground truncate">
            {adminName ? `${adminName} · ${adminEmail}` : adminEmail}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filter accordion */}
      <Collapsible open={controlsOpen} onOpenChange={setControlsOpen}>
        <CollapsibleTrigger asChild>
          <div
            className="flex flex-wrap cursor-pointer select-none items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/50"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setControlsOpen((v) => !v);
              }
            }}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasActiveFilters && (
                <>
                  {dateFrom && (
                    <Badge variant="secondary" className="gap-1 h-6 font-normal text-xs">
                      From {dateFrom}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-4"
                        onClick={(e) => { e.stopPropagation(); setDateFrom(''); }}
                        aria-label="Clear from date"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {dateTo && (
                    <Badge variant="secondary" className="gap-1 h-6 font-normal text-xs">
                      To {dateTo}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-4"
                        onClick={(e) => { e.stopPropagation(); setDateTo(''); }}
                        aria-label="Clear to date"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {source !== 'all' && sourceLabel && (
                    <Badge variant="secondary" className="gap-1 h-6 font-normal text-xs">
                      {sourceLabel}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-4"
                        onClick={(e) => { e.stopPropagation(); setSource('all'); }}
                        aria-label="Clear source"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {category !== 'all' && categoryLabel && (
                    <Badge variant="secondary" className="gap-1 h-6 font-normal text-xs">
                      {categoryLabel}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-4"
                        onClick={(e) => { e.stopPropagation(); setCategory('all'); }}
                        aria-label="Clear category"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                  >
                    Clear
                  </Button>
                </>
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  controlsOpen && 'rotate-180'
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <AuditLogFilters
            showAdminEmail={false}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            sort={sort}
            onSortChange={setSort}
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
        </CollapsibleContent>
      </Collapsible>

      <Card>
        <CardHeader className="border-b py-3 px-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <CardTitle className="text-base font-semibold">Activity timeline</CardTitle>
            <CardDescription className="text-xs m-0">
              {loading ? 'Loading…' : `${total.toLocaleString()} entries`}
            </CardDescription>
            <div className="hidden sm:flex items-center gap-3 text-sm border-l pl-4">
              <CompactStat label="Panel" value={panelTotal} loading={loading} />
              <CompactStat label="Sessions" value={sessionTotal} loading={loading} />
              <CompactStat label="PC" value={pcActionTotal} loading={loading} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <ActivityTableHeader />
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
                  <TableCell colSpan={5} className="py-10">
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
                      className="group cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
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
                      <TableCell className="align-top py-2 pl-4">
                        <WhenCell iso={entry.createdAt} />
                      </TableCell>
                      <TableCell className="align-top whitespace-normal min-w-0 py-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm leading-snug text-foreground">
                              {sanitizeSummaryForDisplay(entry.loginSummary)}
                            </span>
                            <SessionRecordsBadge count={entry.actionCount} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-2">
                        <Badge variant="secondary" className="font-normal">
                          Login session
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top py-2">
                        <span className="text-xs text-foreground/80 truncate block max-w-[200px]">
                          {customerLabel}
                        </span>
                      </TableCell>
                      <TableCell className="align-top py-2 pr-4">
                        <Badge variant="outline" className="text-xs font-normal">
                          Impersonation
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <Separator />
          <div className="px-4 py-3">
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
          <div className="border-t bg-muted/30 px-4 py-2.5 rounded-b-xl">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 shrink-0" />
                Showing activity since {liveStartDateLabel}. Older records are stored in the data
                warehouse.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={openWarehouseModal}
              >
                Load older activity
              </Button>
            </div>
          </div>
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

      <Dialog
        open={warehouseOpen}
        onOpenChange={(open) => {
          if (!open) closeWarehouseModal();
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,900px)] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="space-y-3 border-b px-6 py-4 pr-14 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Older activity (data warehouse)
            </DialogTitle>
            <DialogDescription>
              All archived activity before {liveStartDateLabel}, loaded from the data warehouse.
              Current source and category filters are applied.
            </DialogDescription>
            {warehouseLoading && (
              <div className="space-y-1.5">
                <Progress
                  value={
                    warehouseProgress.total > 0
                      ? (warehouseProgress.loaded / warehouseProgress.total) * 100
                      : undefined
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {warehouseProgress.total > 0
                    ? `Loading archive… ${warehouseProgress.loaded} / ${warehouseProgress.total} months · ${warehouseRows.length.toLocaleString()} records so far`
                    : 'Finding archive months…'}
                </p>
              </div>
            )}
            {!warehouseLoading && !warehouseError && (
              <p className="text-xs text-muted-foreground">
                {warehouseRows.length.toLocaleString()} record{warehouseRows.length === 1 ? '' : 's'} found
              </p>
            )}
          </DialogHeader>

          <ScrollArea className="h-[min(60vh,640px)]">
            <Table>
              <ActivityTableHeader />
              <TableBody>
                {warehouseError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10">
                      <div className="flex flex-col items-center justify-center text-center gap-3">
                        <p className="text-sm font-medium text-destructive">{warehouseError}</p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void loadWarehouse()}
                          disabled={warehouseLoading}
                        >
                          Retry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : warehouseRows.length === 0 && warehouseLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="py-3">
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : warehouseRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center gap-2">
                        <Database className="h-10 w-10 text-muted-foreground/50" />
                        <p className="text-sm font-medium">No archived activity found</p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          Nothing in the data warehouse matches the current source and category
                          filters for this admin.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedWarehouseRows.map((row) => renderActivityRow(row))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {warehouseRows.length > 0 && (
            <div className="border-t px-4 py-3">
              <AdminActivityPagination
                page={warehousePage}
                totalPages={warehouseTotalPages}
                total={warehouseRows.length}
                limit={warehouseLimit}
                loading={false}
                compact={false}
                onPageChange={setWarehousePage}
                onLimitChange={(next) => {
                  setWarehouseLimit(next);
                  setWarehousePage(1);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
