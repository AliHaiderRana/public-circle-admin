'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
  type UnifiedActivityRow,
} from '@/lib/unified-admin-activity';
import { Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type UnifiedAdminActivityPanelProps = {
  adminEmailFilter?: string;
  onClearAdminFilter?: () => void;
  initialUserEmail?: string;
  initialUserId?: string;
  defaultSource?: string;
  defaultLimit?: number;
  showFilters?: boolean;
  hideHeader?: boolean;
  compact?: boolean;
  title?: string;
  description?: string;
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

export default function UnifiedAdminActivityPanel({
  adminEmailFilter = '',
  onClearAdminFilter,
  initialUserEmail = '',
  initialUserId = '',
  defaultSource = 'all',
  defaultLimit = 25,
  showFilters = true,
  hideHeader = false,
  compact = false,
  title = 'Admin audit log',
  description = 'Everything this admin did in the admin panel and in Public Circle (Login as user), in one timeline.',
}: UnifiedAdminActivityPanelProps) {
  const [activities, setActivities] = useState<UnifiedActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [panelTotal, setPanelTotal] = useState(0);
  const [publicCircleTotal, setPublicCircleTotal] = useState(0);
  const [source, setSource] = useState(defaultSource);
  const [category, setCategory] = useState('all');
  const [adminEmailInput, setAdminEmailInput] = useState(adminEmailFilter);
  const [userEmailInput, setUserEmailInput] = useState(initialUserEmail);
  const [userIdFilter] = useState(initialUserId);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<AuditSortOrder>('desc');
  const [refreshKey, setRefreshKey] = useState(0);

  const effectiveAdminEmail = adminEmailFilter.trim() || adminEmailInput.trim();
  const categoryOptions = useMemo(() => buildUnifiedCategoryOptions(source), [source]);

  useEffect(() => {
    setAdminEmailInput(adminEmailFilter);
  }, [adminEmailFilter]);

  useEffect(() => {
    setUserEmailInput(initialUserEmail);
  }, [initialUserEmail]);

  useEffect(() => {
    setSource(defaultSource);
  }, [defaultSource]);

  useEffect(() => {
    setPage(1);
  }, [source, category, effectiveAdminEmail, userEmailInput, limit, dateFrom, dateTo, sort]);

  useEffect(() => {
    if (category === 'all') return;
    const stillValid = categoryOptions.some((opt) => opt.value === category);
    if (!stillValid) setCategory('all');
  }, [category, categoryOptions]);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        source,
        category,
        sort,
        hideNoise: 'true',
      });
      if (effectiveAdminEmail) params.set('adminEmail', effectiveAdminEmail);
      if (userEmailInput.trim()) params.set('userEmail', userEmailInput.trim());
      if (userIdFilter.trim()) params.set('userId', userIdFilter.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/admin-unified-activities?${params}&_=${refreshKey}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');

      setActivities(json.activities ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotal(json.pagination?.total ?? 0);
      setPanelTotal(json.pagination?.panelTotal ?? 0);
      setPublicCircleTotal(json.pagination?.publicCircleTotal ?? 0);
    } catch (err) {
      console.error(err);
      setActivities([]);
      setTotal(0);
      setTotalPages(1);
      setPanelTotal(0);
      setPublicCircleTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    source,
    category,
    effectiveAdminEmail,
    userEmailInput,
    userIdFilter,
    dateFrom,
    dateTo,
    sort,
    refreshKey,
  ]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const groupedCategoryOptions = useMemo(() => {
    const groups = new Map<string, { value: string; label: string }[]>();
    for (const opt of categoryOptions) {
      if (!groups.has(opt.group)) groups.set(opt.group, []);
      groups.get(opt.group)!.push({ value: opt.value, label: opt.label });
    }
    return groups;
  }, [categoryOptions]);

  const activityList = loading ? (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className={cn('w-full', compact ? 'h-14' : 'h-16')} />
      ))}
    </div>
  ) : activities.length === 0 ? (
    <p className="text-sm text-muted-foreground py-8 text-center">
      {effectiveAdminEmail
        ? `No activity recorded for ${effectiveAdminEmail}.`
        : 'No admin activity recorded yet.'}
    </p>
  ) : (
    <div className="space-y-3">
      {activities.map((row) => {
        const detailLines = formatDetailLines(row);
        return (
          <div
            key={row.id}
            className={cn('rounded-lg border bg-card space-y-2', compact ? 'p-3' : 'p-4')}
          >
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
              <Badge
                variant={row.source === 'admin_panel' ? 'secondary' : 'outline'}
                className="font-normal"
              >
                {UNIFIED_SOURCE_LABELS[row.source]}
              </Badge>
              <Badge variant="outline">{row.categoryLabel}</Badge>
              {row.actorIsPartner ? (
                <Badge variant="outline" className="font-normal border-amber-300/80 text-amber-900 dark:text-amber-200">
                  {row.referralRole === 'SALES_PERSON'
                    ? 'Sales partner'
                    : row.referralRole === 'MARKETING_AFFILIATE'
                      ? 'Marketing partner'
                      : 'Support partner'}
                </Badge>
              ) : row.actorWasSuperAdmin && !adminEmailFilter ? (
                <Badge className="gap-1">
                  <Shield className="h-3 w-3" />
                  Super admin
                </Badge>
              ) : !adminEmailFilter && row.source === 'admin_panel' ? (
                <Badge variant="secondary" className="font-normal">
                  Support admin
                </Badge>
              ) : null}
              {!adminEmailFilter && (
                <span className="text-muted-foreground">
                  {row.adminName?.trim()
                    ? `${row.adminName} (${row.adminEmail})`
                    : row.adminEmail}
                </span>
              )}
              {row.source === 'public_circle' && row.impersonatedUserEmail && (
                <span className="text-muted-foreground">
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
      })}
    </div>
  );

  return (
    <div className={cn('space-y-4', compact && 'flex flex-col min-h-0 flex-1')}>
      {!hideHeader && (
        <div>
          <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          {!loading && (
            <p className="text-xs text-muted-foreground mt-2">
              {total} total
              {source === 'all' && total > 0
                ? ` (${panelTotal} admin panel, ${publicCircleTotal} Public Circle)`
                : ''}
            </p>
          )}
          {adminEmailFilter && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                Filtered to {adminEmailFilter}
              </Badge>
              {onClearAdminFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={onClearAdminFilter}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear filter
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {showFilters && (
        <AuditLogFilters
          showAdminEmail={!adminEmailFilter}
          adminEmail={adminEmailInput}
          onAdminEmailChange={adminEmailFilter ? undefined : setAdminEmailInput}
          showUserEmail={source !== 'admin_panel'}
          userEmail={userEmailInput}
          onUserEmailChange={setUserEmailInput}
          userEmailLabel="Customer email (Public Circle)"
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          sort={sort}
          onSortChange={setSort}
          onRefresh={handleRefresh}
          refreshing={loading}
          title="Filters"
          description="Filter by source, admin, customer, category, and date."
        >
          <div className="space-y-2">
            <Label htmlFor="unified-source-filter">Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="unified-source-filter">
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
            <Label htmlFor="unified-category-filter">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="unified-category-filter">
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
      )}

      <div className={cn(compact && 'flex flex-col min-h-0 flex-1')}>
        <Card className={cn(compact ? 'border-0 shadow-none flex flex-col min-h-0 flex-1' : undefined)}>
          <CardContent
            className={cn(
              compact ? 'p-0 flex flex-col min-h-0 flex-1' : 'pt-6',
              compact && 'pb-0'
            )}
          >
            <div className={cn(compact && 'flex-1 min-h-0 overflow-y-auto pr-0.5')}>
              {activityList}
            </div>
            {!compact && (
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
            )}
          </CardContent>
        </Card>
        {compact && (
          <AdminActivityPagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            loading={loading}
            compact
            sticky
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        )}
      </div>
    </div>
  );
}
