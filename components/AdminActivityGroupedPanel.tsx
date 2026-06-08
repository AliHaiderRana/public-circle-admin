'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  type UnifiedActivityRow,
} from '@/lib/unified-admin-activity';
import { LayoutDashboard, Shield, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type CustomerSummary = {
  email: string;
  activityCount: number;
  lastActivityAt: string;
};

type TrackPagination = {
  page: number;
  totalPages: number;
  total: number;
};

function formatDetailLines(row: UnifiedActivityRow): string[] {
  const details = row.details;
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    lines.push(`${label}: ${String(value)}`);
  };

  if (row.source === 'public_circle') {
    push('Customer', row.impersonatedUserEmail);
    push('Session', row.sessionId);
    push('Method', row.method);
    push('Path', row.path);
    push('Status', row.statusCode);
    if (row.metadata && typeof row.metadata.entityName === 'string') {
      push('Entity', row.metadata.entityName);
    }
    return lines;
  }

  if (!details || typeof details !== 'object') return lines;
  push('Previous status', details.previousStatus);
  push('New status', details.status);
  push('Subject', details.subject);
  push('Category', details.categoryLabel || details.category);
  push('Request type', details.type);
  push('Company', details.companyName);
  push('Impersonated user', details.impersonatedUserEmail);
  push('Plan', details.planName);
  push('Cron', details.cronName);
  push('Translation key', details.key);
  push('Language', details.code || details.locale);
  push('Template', details.name);
  if (details.fieldsChanged && Array.isArray(details.fieldsChanged)) {
    push('Fields changed', details.fieldsChanged.join(', '));
  }
  if (typeof details.usersBlocked === 'number') push('Users blocked', details.usersBlocked);
  if (typeof details.usersUnblocked === 'number') push('Users unblocked', details.usersUnblocked);
  if (typeof details.campaignsPaused === 'number') push('Campaigns paused', details.campaignsPaused);
  return lines;
}

function ActivityRow({ row, showAdmin }: { row: UnifiedActivityRow; showAdmin?: boolean }) {
  const detailLines = formatDetailLines(row);
  return (
    <div className="rounded-lg border bg-card space-y-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-sm leading-snug pr-2">{row.summary}</p>
        <time
          dateTime={row.createdAt}
          className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
        >
          {new Date(row.createdAt).toLocaleString()}
        </time>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="text-[10px]">
          {row.categoryLabel}
        </Badge>
        {row.actorWasSuperAdmin && showAdmin && (
          <Badge className="gap-1 text-[10px]">
            <Shield className="h-3 w-3" />
            Super admin
          </Badge>
        )}
        {row.source === 'public_circle' && row.impersonatedUserEmail && (
          <span className="text-muted-foreground truncate max-w-[180px]">
            as {row.impersonatedUserEmail}
          </span>
        )}
      </div>
      {detailLines.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            More detail
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground list-disc pl-4">
            {detailLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CategorySelect({
  id,
  value,
  onChange,
  options,
  groupedOptions,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: ReturnType<typeof buildUnifiedCategoryOptions>;
  groupedOptions: (
    opts: ReturnType<typeof buildUnifiedCategoryOptions>
  ) => Map<string, { value: string; label: string }[]>;
}) {
  return (
    <div className="space-y-1.5 w-full sm:w-[200px]">
      <Label htmlFor={id} className="text-xs">
        Category
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from(groupedOptions(options).entries()).map(([group, opts]) => (
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
  );
}

function TrackSection({
  title,
  description,
  icon,
  rows,
  loading,
  emptyMessage,
  pagination,
  limit,
  onPageChange,
  onLimitChange,
  headerExtra,
  beforeList,
  className,
  compactPagination = true,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  rows: UnifiedActivityRow[];
  loading: boolean;
  emptyMessage: string;
  pagination: TrackPagination;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  headerExtra?: React.ReactNode;
  beforeList?: React.ReactNode;
  className?: string;
  compactPagination?: boolean;
}) {
  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            {icon}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">{title}</CardTitle>
                {!loading && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {pagination.total}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          {headerExtra}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-3 pt-0">
        {beforeList}
        <div className="flex-1 min-h-0 space-y-2 max-h-[min(70vh,720px)] overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{emptyMessage}</p>
          ) : (
            rows.map((row) => <ActivityRow key={row.id} row={row} />)
          )}
        </div>
        <AdminActivityPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={limit}
          loading={loading}
          compact={compactPagination}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
        />
      </CardContent>
    </Card>
  );
}

function CustomerChips({
  customers,
  loading,
  selectedCustomer,
  onSelect,
}: {
  customers: CustomerSummary[];
  loading: boolean;
  selectedCustomer: string;
  onSelect: (email: string) => void;
}) {
  if (loading) {
    return <Skeleton className="h-8 w-full max-w-lg" />;
  }
  if (customers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No Public Circle sessions recorded for this admin yet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        type="button"
        size="sm"
        variant={selectedCustomer === '' ? 'default' : 'outline'}
        className="h-7 text-xs"
        onClick={() => onSelect('')}
      >
        All customers
      </Button>
      {customers.map((customer) => (
        <Button
          key={customer.email}
          type="button"
          size="sm"
          variant={selectedCustomer === customer.email ? 'default' : 'outline'}
          className="h-7 text-xs font-normal max-w-[220px]"
          onClick={() =>
            onSelect(selectedCustomer === customer.email ? '' : customer.email)
          }
        >
          <span className="truncate">{customer.email}</span>
          <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px] shrink-0">
            {customer.activityCount}
          </Badge>
        </Button>
      ))}
    </div>
  );
}

type AdminActivityGroupedPanelProps = {
  adminEmail: string;
  adminName?: string;
};

export default function AdminActivityGroupedPanel({
  adminEmail,
  adminName,
}: AdminActivityGroupedPanelProps) {
  const displayName = adminName?.trim() || adminEmail;

  const [panelRows, setPanelRows] = useState<UnifiedActivityRow[]>([]);
  const [pcRows, setPcRows] = useState<UnifiedActivityRow[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loadingPanel, setLoadingPanel] = useState(true);
  const [loadingPc, setLoadingPc] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  const [panelPage, setPanelPage] = useState(1);
  const [pcPage, setPcPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [panelPagination, setPanelPagination] = useState<TrackPagination>({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [pcPagination, setPcPagination] = useState<TrackPagination>({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const [panelCategory, setPanelCategory] = useState('all');
  const [pcCategory, setPcCategory] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<AuditSortOrder>('desc');
  const [refreshKey, setRefreshKey] = useState(0);

  const panelCategoryOptions = useMemo(
    () => buildUnifiedCategoryOptions('admin_panel'),
    []
  );
  const pcCategoryOptions = useMemo(
    () => buildUnifiedCategoryOptions('public_circle'),
    []
  );

  const groupedOptions = (options: ReturnType<typeof buildUnifiedCategoryOptions>) => {
    const groups = new Map<string, { value: string; label: string }[]>();
    for (const opt of options) {
      if (!groups.has(opt.group)) groups.set(opt.group, []);
      groups.get(opt.group)!.push({ value: opt.value, label: opt.label });
    }
    return groups;
  };

  const buildBaseParams = useCallback(() => {
    const params = new URLSearchParams({
      adminEmail,
      sort,
      hideNoise: 'true',
    });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params;
  }, [adminEmail, sort, dateFrom, dateTo]);

  const fetchPanel = useCallback(async () => {
    setLoadingPanel(true);
    try {
      const params = buildBaseParams();
      params.set('source', 'admin_panel');
      params.set('page', String(panelPage));
      params.set('limit', String(limit));
      if (panelCategory !== 'all') params.set('category', panelCategory);

      const res = await fetch(`/api/admin-unified-activities?${params}&_=${refreshKey}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);

      setPanelRows(json.activities ?? []);
      setPanelPagination({
        page: json.pagination?.page ?? panelPage,
        totalPages: json.pagination?.totalPages ?? 1,
        total: json.pagination?.panelTotal ?? json.pagination?.total ?? 0,
      });
    } catch {
      setPanelRows([]);
      setPanelPagination({ page: 1, totalPages: 1, total: 0 });
    } finally {
      setLoadingPanel(false);
    }
  }, [buildBaseParams, panelPage, limit, panelCategory, refreshKey]);

  const fetchPc = useCallback(async () => {
    setLoadingPc(true);
    try {
      const params = buildBaseParams();
      params.set('source', 'public_circle');
      params.set('page', String(pcPage));
      params.set('limit', String(limit));
      if (pcCategory !== 'all') params.set('category', pcCategory);
      if (selectedCustomer) params.set('userEmail', selectedCustomer);

      const res = await fetch(`/api/admin-unified-activities?${params}&_=${refreshKey}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);

      setPcRows(json.activities ?? []);
      setPcPagination({
        page: json.pagination?.page ?? pcPage,
        totalPages: json.pagination?.totalPages ?? 1,
        total: json.pagination?.publicCircleTotal ?? json.pagination?.total ?? 0,
      });
    } catch {
      setPcRows([]);
      setPcPagination({ page: 1, totalPages: 1, total: 0 });
    } finally {
      setLoadingPc(false);
    }
  }, [buildBaseParams, pcPage, limit, pcCategory, selectedCustomer, refreshKey]);

  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const params = buildBaseParams();
      params.set('customers', '1');
      const res = await fetch(`/api/admin-unified-activities?${params}&_=${refreshKey}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      setCustomers(json.customers ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }, [buildBaseParams, refreshKey]);

  useEffect(() => {
    setPanelPage(1);
    setPcPage(1);
  }, [adminEmail, dateFrom, dateTo, sort, panelCategory, pcCategory, selectedCustomer, limit]);

  useEffect(() => {
    void fetchPanel();
  }, [fetchPanel]);

  useEffect(() => {
    void fetchPc();
  }, [fetchPc]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const totalCount = panelPagination.total + pcPagination.total;
  const countsLoading = loadingPanel || loadingPc;

  const panelTrack = (
    <TrackSection
      title="Admin panel"
      description="Support, companies, templates, config, impersonation starts."
      icon={<LayoutDashboard className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
      rows={panelRows}
      loading={loadingPanel}
      emptyMessage="No admin panel activity recorded."
      pagination={panelPagination}
      limit={limit}
      onPageChange={setPanelPage}
      onLimitChange={setLimit}
      headerExtra={
        <CategorySelect
          id="panel-category-filter"
          value={panelCategory}
          onChange={setPanelCategory}
          options={panelCategoryOptions}
          groupedOptions={groupedOptions}
        />
      }
    />
  );

  const pcEmptyMessage = selectedCustomer
    ? `No Public Circle activity for ${selectedCustomer}.`
    : 'No Public Circle activity recorded.';

  const pcTrack = (
    <TrackSection
      title="Public Circle"
      description="Actions after Login as user — campaigns, contacts, billing."
      icon={<ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
      rows={pcRows}
      loading={loadingPc}
      emptyMessage={pcEmptyMessage}
      pagination={pcPagination}
      limit={limit}
      onPageChange={setPcPage}
      onLimitChange={setLimit}
      headerExtra={
        <CategorySelect
          id="pc-category-filter"
          value={pcCategory}
          onChange={setPcCategory}
          options={pcCategoryOptions}
          groupedOptions={groupedOptions}
        />
      }
    />
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-semibold tracking-tight">Activity — {displayName}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Two parallel tracks: admin app changes and customer-app actions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Admin panel
            </div>
            <p className="text-2xl font-semibold mt-1 tabular-nums">
              {countsLoading ? '—' : panelPagination.total}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              Public Circle
            </div>
            <p className="text-2xl font-semibold mt-1 tabular-nums">
              {countsLoading ? '—' : pcPagination.total}
            </p>
          </CardContent>
        </Card>
      </div>

      {!countsLoading && totalCount > 0 && (
        <p className="text-xs text-muted-foreground -mt-2">
          {totalCount} total events
          {selectedCustomer ? ` · Public Circle filtered to ${selectedCustomer}` : ''}
        </p>
      )}

      <AuditLogFilters
        showAdminEmail={false}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        sort={sort}
        onSortChange={setSort}
        onRefresh={handleRefresh}
        refreshing={loadingPanel || loadingPc || loadingCustomers}
        title="Filters"
        description="Date range and sort apply to both tracks."
      />

      {(loadingCustomers || customers.length > 0) && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">Customers acted as</CardTitle>
            <CardDescription className="text-xs">
              Select a customer email to filter the Public Circle track.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <CustomerChips
              customers={customers}
              loading={loadingCustomers}
              selectedCustomer={selectedCustomer}
              onSelect={setSelectedCustomer}
            />
          </CardContent>
        </Card>
      )}

      {/* Side-by-side on xl+ */}
      <div className="hidden xl:grid xl:grid-cols-2 xl:gap-5 xl:items-stretch">
        {panelTrack}
        {pcTrack}
      </div>

      {/* Tabs on smaller screens */}
      <div className="xl:hidden">
        <Tabs defaultValue="panel" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="panel" className="gap-2 text-xs sm:text-sm">
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
              Admin panel
              {!loadingPanel && (
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {panelPagination.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pc" className="gap-2 text-xs sm:text-sm">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Public Circle
              {!loadingPc && (
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {pcPagination.total}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="panel" className="mt-4">
            {panelTrack}
          </TabsContent>
          <TabsContent value="pc" className="mt-4">
            {pcTrack}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
