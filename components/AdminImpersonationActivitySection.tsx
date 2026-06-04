'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import AdminActivityPagination from '@/components/AdminActivityPagination';
import {
  IMPERSONATION_ACTIVITY_CATEGORY_LABELS,
  IMPERSONATION_ACTIVITY_TYPE_LABELS,
} from '@/lib/impersonation-activity-labels';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ImpersonationActivityRow = {
  id: string;
  sessionId: string;
  type: string;
  adminEmail: string;
  adminName: string;
  userId: string;
  impersonatedUserEmail: string;
  companyId: string;
  method: string | null;
  path: string | null;
  summary: string | null;
  statusCode: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type AdminImpersonationActivitySectionProps = {
  companyId?: string;
  userId?: string;
  sessionId?: string;
  title?: string;
  description?: string;
  defaultLimit?: number;
  compact?: boolean;
};

function typeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (type === 'SESSION_START') return 'default';
  if (type === 'SESSION_END') return 'secondary';
  return 'outline';
}

export default function AdminImpersonationActivitySection({
  companyId,
  userId,
  sessionId,
  title = 'Login as user activity',
  description = 'Actions performed in Public Circle while an admin was signed in as this customer.',
  defaultLimit = 15,
  compact = false,
}: AdminImpersonationActivitySectionProps) {
  const [rows, setRows] = useState<ImpersonationActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (companyId) params.set('companyId', companyId);
      if (userId) params.set('userId', userId);
      if (sessionId) params.set('sessionId', sessionId);

      const res = await fetch(`/api/admin-impersonation-activities?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setRows(data.activities ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setTotal(data.pagination?.total ?? 0);
    } catch {
      setRows([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [companyId, userId, sessionId, page, limit]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  const categoryLabel = (row: ImpersonationActivityRow) => {
    const cat = row.metadata?.category;
    if (typeof cat === 'string' && IMPERSONATION_ACTIVITY_CATEGORY_LABELS[cat]) {
      return IMPERSONATION_ACTIVITY_CATEGORY_LABELS[cat];
    }
    return null;
  };

  return (
    <Card className={cn(compact && 'border-0 shadow-none')}>
      <CardHeader className={cn(compact && 'px-0 pt-0')}>
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(compact && 'px-0 pb-0')}>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No impersonation activity recorded yet for this filter.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium leading-snug">
                    {row.summary || row.path || 'Activity'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.adminName ? `${row.adminName} · ` : ''}
                    {row.adminEmail}
                    {row.impersonatedUserEmail ? ` → ${row.impersonatedUserEmail}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                  <Badge variant={typeBadgeVariant(row.type)}>
                    {IMPERSONATION_ACTIVITY_TYPE_LABELS[row.type] ?? row.type}
                  </Badge>
                  {categoryLabel(row) ? (
                    <Badge variant="outline">{categoryLabel(row)}</Badge>
                  ) : null}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && total > 0 ? (
          <div className="mt-4">
            <AdminActivityPagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
              compact={compact}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
