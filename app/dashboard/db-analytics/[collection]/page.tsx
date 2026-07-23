'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import AdminActivityPagination from '@/components/AdminActivityPagination';
import {
  ArrowLeft,
  Building2,
  Database,
  Eye,
  FileStack,
  HardDrive,
  Key,
  Layers,
  RefreshCw,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatBytes,
  formatCount,
  type CollectionAnalytics,
  type CompanyStats,
  type CompanyStatsRow,
} from '../format';
import { StatCard } from '../StatCard';

const COMPANY_PAGE_SIZE_DEFAULT = 25;

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
      <Button type="button" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function DbCollectionDetailContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ collection: string }>();
  const searchParams = useSearchParams();
  const collectionName = decodeURIComponent(params.collection ?? '');
  const databaseName = searchParams.get('database') || '';
  const backHref = databaseName
    ? `/dashboard/db-analytics/database/${encodeURIComponent(databaseName)}`
    : '/dashboard/db-analytics';

  const [activeTab, setActiveTab] = useState('overview');

  // Storage metadata (from $collStats — no document reads)
  const [storage, setStorage] = useState<CollectionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-company counts (lazy, on tab open)
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
  const [companyLoaded, setCompanyLoaded] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState('');
  const [companyPage, setCompanyPage] = useState(1);
  const [companyLimit, setCompanyLimit] = useState(COMPANY_PAGE_SIZE_DEFAULT);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchStorage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ name: collectionName });
      if (databaseName) qs.set('database', databaseName);
      const res = await fetch(`/api/db-analytics/collection?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load collection stats');
      setStorage(json.storage ?? null);
    } catch (err) {
      setStorage(null);
      setError(err instanceof Error ? err.message : 'Failed to load collection stats');
    } finally {
      setLoading(false);
    }
  }, [collectionName, databaseName]);

  const fetchCompanyStats = useCallback(async () => {
    setCompanyLoading(true);
    setCompanyError(null);
    try {
      const qs = new URLSearchParams({ name: collectionName, section: 'companies' });
      if (databaseName) qs.set('database', databaseName);
      const res = await fetch(`/api/db-analytics/collection?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load company stats');
      setCompanyStats(json.companyStats ?? null);
      setCompanyLoaded(true);
      setCompanyPage(1);
    } catch (err) {
      setCompanyStats(null);
      setCompanyError(err instanceof Error ? err.message : 'Failed to load company stats');
    } finally {
      setCompanyLoading(false);
    }
  }, [collectionName, databaseName]);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin && collectionName) {
      void fetchStorage();
    }
  }, [authLoading, user, collectionName, fetchStorage]);

  useEffect(() => {
    if (activeTab === 'companies' && !companyLoaded && !companyLoading && user?.isSuperAdmin) {
      void fetchCompanyStats();
    }
  }, [activeTab, companyLoaded, companyLoading, user, fetchCompanyStats]);

  const handleRefresh = useCallback(() => {
    void fetchStorage();
    setCompanyLoaded(false);
    setCompanyStats(null);
    if (activeTab === 'companies') {
      void fetchCompanyStats();
    }
  }, [fetchStorage, fetchCompanyStats, activeTab]);

  // Company search + client-side pagination
  const filteredCompanyRows = useMemo(() => {
    const rows = companyStats?.rows ?? [];
    const q = companySearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.companyName ?? '').toLowerCase().includes(q) ||
        (r.companyId ?? '').toLowerCase().includes(q)
    );
  }, [companyStats, companySearch]);

  useEffect(() => {
    setCompanyPage(1);
  }, [companySearch, companyLimit]);

  const companyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredCompanyRows.length / companyLimit)),
    [filteredCompanyRows.length, companyLimit]
  );

  const paginatedCompanyRows = useMemo(() => {
    const start = (companyPage - 1) * companyLimit;
    return filteredCompanyRows.slice(start, start + companyLimit);
  }, [filteredCompanyRows, companyPage, companyLimit]);

  const companyDocsHref = useCallback(
    (row: CompanyStatsRow) => {
      const qs = new URLSearchParams({
        field: companyStats?.field ?? '',
        company: row.companyId ?? 'none',
      });
      if (row.companyName) qs.set('companyName', row.companyName);
      if (databaseName) qs.set('database', databaseName);
      return `/dashboard/db-analytics/${encodeURIComponent(collectionName)}/documents?${qs}`;
    },
    [collectionName, companyStats, databaseName]
  );

  const indexEntries = useMemo(
    () => (storage ? Object.entries(storage.indexSizes).sort((a, b) => b[1] - a[1]) : []),
    [storage]
  );

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 h-8" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              DB Analytics
            </Link>
          </Button>
          <span className="hidden sm:inline text-muted-foreground">/</span>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Database className="size-5 text-muted-foreground" />
            <span className="font-mono">{collectionName}</span>
            {storage?.capped && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                capped
              </Badge>
            )}
          </h1>
          {databaseName && (
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {databaseName}
            </Badge>
          )}
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

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button type="button" size="sm" onClick={() => void fetchStorage()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading || !storage ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={HardDrive}
              label="Total size (billed usage)"
              value={formatBytes(storage.size + storage.totalIndexSize)}
              hint={`${formatBytes(storage.size)} data · ${formatBytes(storage.totalIndexSize)} indexes`}
            />
            <StatCard
              icon={FileStack}
              label="Data size"
              value={formatBytes(storage.size)}
              hint={
                storage.storageSize > 0
                  ? `${(storage.size / storage.storageSize).toFixed(1)}× compression ratio`
                  : undefined
              }
            />
            <StatCard
              icon={Layers}
              label="Documents"
              value={formatCount(storage.count)}
              hint={`avg ${formatBytes(storage.avgObjSize)} each`}
            />
            <StatCard
              icon={Key}
              label="Total index size"
              value={formatBytes(storage.totalIndexSize)}
              hint={`${storage.nindexes} indexes total`}
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="companies">By company</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <Card>
                <CardContent className="p-4">
                  <p className="pb-2 text-sm font-medium">
                    Indexes ({storage.nindexes}) — {formatBytes(storage.totalIndexSize)}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Index</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {indexEntries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="py-6 text-center text-sm text-muted-foreground"
                          >
                            No index information available.
                          </TableCell>
                        </TableRow>
                      ) : (
                        indexEntries.map(([name, size]) => (
                          <TableRow key={name}>
                            <TableCell className="font-mono text-xs">{name}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {formatBytes(size)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="companies" className="mt-0">
              <Card>
                <CardContent className="p-0">
                  {companyLoading ? (
                    <div className="space-y-2 p-4">
                      <p className="pb-1 text-xs text-muted-foreground">
                        Measuring exact per-company sizes — this can take a while on large
                        collections.
                      </p>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                      ))}
                    </div>
                  ) : companyError ? (
                    <SectionError
                      message={companyError}
                      onRetry={() => void fetchCompanyStats()}
                    />
                  ) : companyStats ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {companySearch.trim()
                              ? `${formatCount(filteredCompanyRows.length)} of ${formatCount(companyStats.rows.length)} companies`
                              : `${formatCount(companyStats.totalCompanies)} compan${companyStats.totalCompanies === 1 ? 'y' : 'ies'}`}{' '}
                            · grouped by{' '}
                            <code className="rounded bg-muted px-1 font-mono">
                              {companyStats.field}
                            </code>
                          </span>
                          {companyStats.truncated && (
                            <Badge variant="outline" className="text-[10px] font-normal">
                              showing top {formatCount(companyStats.rows.length)} by count
                            </Badge>
                          )}
                        </div>
                        <div className="relative w-56">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search company name or ID…"
                            className="h-8 pl-9"
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="pl-4">Company</TableHead>
                            <TableHead className="text-right">Documents</TableHead>
                            <TableHead className="text-right">Size</TableHead>
                            <TableHead className="w-[110px] pr-4 text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedCompanyRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                {companySearch.trim()
                                  ? `No companies match “${companySearch.trim()}”.`
                                  : 'No company data.'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedCompanyRows.map((row) => (
                              <TableRow key={row.companyId ?? '__none__'}>
                                <TableCell className="py-2 pl-4">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm">
                                        {row.companyName ??
                                          (row.companyId ? 'Unknown company' : 'No company')}
                                      </p>
                                      {row.companyId && (
                                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                                          {row.companyId}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-right tabular-nums text-sm">
                                  {formatCount(row.count)}
                                </TableCell>
                                <TableCell className="py-2 text-right tabular-nums text-sm">
                                  {formatBytes(row.size)}
                                </TableCell>
                                <TableCell className="py-2 pr-4 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    asChild
                                  >
                                    <Link href={companyDocsHref(row)}>
                                      <Eye className="h-3.5 w-3.5" />
                                      View
                                    </Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      {filteredCompanyRows.length > 0 && (
                        <div className="border-t px-4 py-3">
                          <AdminActivityPagination
                            page={companyPage}
                            totalPages={companyTotalPages}
                            total={filteredCompanyRows.length}
                            limit={companyLimit}
                            loading={companyLoading}
                            compact={false}
                            onPageChange={setCompanyPage}
                            onLimitChange={setCompanyLimit}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <Building2 className="size-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium">No company field detected</p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        Documents in this collection don&apos;t reference a company
                        (checked: company, companyId, company_id,
                        public_circles_company), so a per-company breakdown isn&apos;t
                        available.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

export default function DbCollectionDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <DbCollectionDetailContent />
    </Suspense>
  );
}
