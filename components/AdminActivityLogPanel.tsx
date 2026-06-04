'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AdminActivityPagination from '@/components/AdminActivityPagination';
import AuditLogFilters from '@/components/AuditLogFilters';
import type { AuditSortOrder } from '@/lib/audit-query';
import {
  ADMIN_AUDIT_CATEGORY,
  ADMIN_AUDIT_CATEGORY_LABELS,
} from '@/lib/admin-audit.constants';
import { Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdminActivityRow = {
  id: string;
  adminEmail: string;
  adminName: string;
  actorWasSuperAdmin: boolean;
  category: string;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
};

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  ...Object.values(ADMIN_AUDIT_CATEGORY).map((value) => ({
    value,
    label: ADMIN_AUDIT_CATEGORY_LABELS[value] ?? value,
  })),
];

type AdminActivityLogPanelProps = {
  /** When set, only shows activity for this admin email. */
  adminEmailFilter?: string;
  onClearAdminFilter?: () => void;
  defaultLimit?: number;
  showFilters?: boolean;
  title?: string;
  description?: string;
  /** Hide page heading when embedded in a dialog. */
  hideHeader?: boolean;
  /** Simpler footer (modal / single-admin view). */
  compact?: boolean;
};

function formatDetailLines(details: Record<string, unknown> | null): string[] {
  if (!details || typeof details !== 'object') return [];
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    lines.push(`${label}: ${String(value)}`);
  };
  push('Previous status', details.previousStatus);
  push('New status', details.status);
  push('Request type', details.type);
  push('Company', details.companyName);
  push('Plan', details.planName);
  push('Cron', details.cronName);
  push('Translation key', details.key);
  push('Language', details.code);
  push('Template', details.name);
  if (details.fieldsChanged && Array.isArray(details.fieldsChanged)) {
    push('Fields changed', details.fieldsChanged.join(', '));
  }
  if (details.quota && typeof details.quota === 'object') {
    push('New quota', JSON.stringify(details.quota));
  }
  const known = new Set([
    'previousStatus',
    'status',
    'type',
    'companyName',
    'planName',
    'cronName',
    'key',
    'code',
    'name',
    'fieldsChanged',
    'quota',
    'previousQuota',
    'companyId',
    'userId',
    'email',
    'isSuperAdmin',
    'enabled',
    'label',
    'changes',
    'impersonatedUserEmail',
  ]);
  for (const [key, value] of Object.entries(details)) {
    if (known.has(key) || value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    lines.push(`${key}: ${String(value)}`);
  }
  return lines;
}

export default function AdminActivityLogPanel({
  adminEmailFilter: adminEmailProp = '',
  onClearAdminFilter,
  defaultLimit = 15,
  showFilters = true,
  title = 'Admin activity log',
  description = 'Important changes in this admin panel — customer requests, companies, templates, plans, crons, translations, context help, and impersonation.',
  hideHeader = false,
  compact = false,
}: AdminActivityLogPanelProps) {
  const [activities, setActivities] = useState<AdminActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('all');
  const [adminEmailInput, setAdminEmailInput] = useState(adminEmailProp);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<AuditSortOrder>('desc');
  const [refreshKey, setRefreshKey] = useState(0);

  const effectiveAdminEmail = adminEmailProp.trim() || adminEmailInput.trim();

  useEffect(() => {
    setAdminEmailInput(adminEmailProp);
  }, [adminEmailProp]);

  useEffect(() => {
    setPage(1);
  }, [category, effectiveAdminEmail, limit, dateFrom, dateTo, sort]);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        category,
      });
      if (effectiveAdminEmail) {
        params.set('adminEmail', effectiveAdminEmail);
      }
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('sort', sort);
      const res = await fetch(`/api/admin-activities?${params}&_=${refreshKey}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load');
      }
      setActivities(json.activities ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) {
      console.error(err);
      setActivities([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, category, effectiveAdminEmail, dateFrom, dateTo, sort, refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

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
      {activities.map((row) => (
        <div
          key={row.id}
          className={cn(
            'rounded-lg border bg-card space-y-2',
            compact ? 'p-3' : 'p-4'
          )}
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
            <Badge variant="outline">
              {ADMIN_AUDIT_CATEGORY_LABELS[row.category] ?? row.category}
            </Badge>
            {row.actorWasSuperAdmin && !adminEmailProp && (
              <Badge className="gap-1">
                <Shield className="h-3 w-3" />
                Super admin
              </Badge>
            )}
            {!adminEmailProp && (
              <span className="text-muted-foreground">
                {row.adminName?.trim()
                  ? `${row.adminName} (${row.adminEmail})`
                  : row.adminEmail}
              </span>
            )}
          </div>
          {row.details && Object.keys(row.details).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                More detail
              </summary>
              <ul className="mt-2 space-y-1 text-muted-foreground list-disc pl-4">
                {formatDetailLines(row.details).map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {formatDetailLines(row.details).length === 0 && (
                  <li className="list-none pl-0">
                    <pre className="max-h-32 overflow-auto rounded bg-muted p-2 font-mono text-[11px] text-foreground">
                      {JSON.stringify(row.details, null, 2)}
                    </pre>
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={cn('space-y-4', compact && 'flex flex-col min-h-0 flex-1')}
      id={hideHeader || compact ? undefined : 'admin-activity-log'}
    >
      {!hideHeader && (
        <div>
          <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          {adminEmailProp && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                Filtered to {adminEmailProp}
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
          showAdminEmail={!adminEmailProp}
          adminEmail={adminEmailInput}
          onAdminEmailChange={adminEmailProp ? undefined : setAdminEmailInput}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          sort={sort}
          onSortChange={setSort}
          onRefresh={handleRefresh}
          refreshing={loading}
          title="Filters"
          description="Filter by category, admin, date range, and sort order."
        >
          <div className="space-y-2">
            <Label htmlFor="activity-category-filter">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="activity-category-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </AuditLogFilters>
      )}

      <div className={cn(compact && 'flex flex-col min-h-0 flex-1')}>
        <Card
          className={cn(
            compact ? 'border-0 shadow-none flex flex-col min-h-0 flex-1' : undefined
          )}
        >
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
