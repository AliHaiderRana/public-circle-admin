'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import AdminActivityPagination from '@/components/AdminActivityPagination';
import { ViewToggle } from '@/components/aws-analytics/ViewToggle';
import {
  compareValues,
  SortableHeader,
  toggleSort,
  type SortState,
} from '@/components/aws-analytics/SortableHeader';
import { useAwsViewMode } from '@/hooks/use-aws-view-mode';
import {
  Building2,
  Cloud,
  Database,
  Eye,
  FileStack,
  Folder,
  HardDrive,
  RefreshCw,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes, formatCompactCount, formatCount } from '../db-analytics/format';

type BucketFolderUsage = {
  folder: string;
  objects: number;
  bytes: number;
};

type BucketStats = {
  name: string;
  objects: number;
  bytes: number;
  truncated: boolean;
  folders: BucketFolderUsage[];
};

type CompanyBucketUsage = {
  bucket: string;
  objects: number;
  bytes: number;
};

type CompanyUsageRow = {
  companyId: string;
  companyName: string | null;
  objects: number;
  bytes: number;
  buckets: CompanyBucketUsage[];
};

type AwsAnalytics = {
  region: string;
  buckets: BucketStats[];
  totals: {
    buckets: number;
    objects: number;
    bytes: number;
  };
  companies: CompanyUsageRow[];
  unattributed: { objects: number; bytes: number };
  generatedAt: string;
};

const COMPANY_PAGE_SIZE_DEFAULT = 10;

type BucketSortKey = 'name' | 'objects' | 'bytes';
type CompanySortKey = 'company' | 'objects' | 'bytes';

const COLUMN_INFO = {
  bucket: 'Name of the S3 storage bucket.',
  objects: 'Number of files stored in the bucket.',
  size: 'Total size of all files in the bucket.',
  company: 'Company the files belong to, based on the file paths.',
  companyObjects: 'Number of files across all buckets belonging to this company.',
  companyStorage: 'Total storage used by this company’s files.',
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="mt-1 h-5 w-20" />
            ) : (
              <p className="truncate text-lg font-semibold tabular-nums leading-tight">
                {value}
              </p>
            )}
            {hint && !loading && (
              <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AwsAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<AwsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState('');
  const [companyPage, setCompanyPage] = useState(1);
  const [companyLimit, setCompanyLimit] = useState(COMPANY_PAGE_SIZE_DEFAULT);
  const [viewMode, setViewMode] = useAwsViewMode();
  const [bucketSort, setBucketSort] = useState<SortState<BucketSortKey>>(null);
  const [companySort, setCompanySort] = useState<SortState<CompanySortKey>>(null);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchAnalytics = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/aws-analytics${forceRefresh ? '?refresh=1' : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load AWS analytics');
      setData(json);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load AWS analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin) {
      void fetchAnalytics();
    }
  }, [authLoading, user, fetchAnalytics]);

  const companyAttributedBytes = useMemo(
    () => data?.companies.reduce((s, c) => s + c.bytes, 0) ?? 0,
    [data]
  );

  const filteredCompanies = useMemo(() => {
    const rows = data?.companies ?? [];
    const q = companySearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.companyName ?? '').toLowerCase().includes(q) ||
        r.companyId.toLowerCase().includes(q)
    );
  }, [data, companySearch]);

  const sortedBuckets = useMemo(() => {
    const rows = data?.buckets ?? [];
    if (!bucketSort) return rows;
    return [...rows].sort((a, b) => {
      const av = bucketSort.key === 'name' ? a.name : a[bucketSort.key];
      const bv = bucketSort.key === 'name' ? b.name : b[bucketSort.key];
      return compareValues(av, bv, bucketSort.dir);
    });
  }, [data, bucketSort]);

  const sortedCompanies = useMemo(() => {
    if (!companySort) return filteredCompanies;
    return [...filteredCompanies].sort((a, b) => {
      const av = companySort.key === 'company' ? (a.companyName ?? a.companyId) : a[companySort.key];
      const bv = companySort.key === 'company' ? (b.companyName ?? b.companyId) : b[companySort.key];
      return compareValues(av, bv, companySort.dir);
    });
  }, [filteredCompanies, companySort]);

  useEffect(() => {
    setCompanyPage(1);
  }, [companySearch, companyLimit, companySort]);

  const companyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredCompanies.length / companyLimit)),
    [filteredCompanies.length, companyLimit]
  );

  const paginatedCompanies = useMemo(() => {
    const start = (companyPage - 1) * companyLimit;
    return sortedCompanies.slice(start, start + companyLimit);
  }, [sortedCompanies, companyPage, companyLimit]);

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
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Cloud className="size-5 text-muted-foreground" />
            AWS S3 Analytics
            {data?.region && (
              <Badge variant="outline" className="font-mono text-xs font-normal">
                {data.region}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Bucket consumption and company-wise storage usage.
            {data?.generatedAt &&
              ` Snapshot taken ${new Date(data.generatedAt).toLocaleTimeString()} · cached up to 10 min.`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void fetchAnalytics(true)}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button type="button" size="sm" onClick={() => void fetchAnalytics()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={HardDrive}
              label="Total S3 storage"
              value={formatBytes(data?.totals.bytes ?? 0)}
              hint={
                data
                  ? `across ${data.totals.buckets} bucket${data.totals.buckets === 1 ? '' : 's'}`
                  : undefined
              }
              loading={loading}
            />
            <StatCard
              icon={FileStack}
              label="Total objects"
              value={formatCount(data?.totals.objects ?? 0)}
              loading={loading}
            />
            <StatCard
              icon={Database}
              label="Buckets"
              value={data ? String(data.totals.buckets) : '—'}
              loading={loading}
            />
            <StatCard
              icon={Building2}
              label="Company-attributed storage"
              value={formatBytes(companyAttributedBytes)}
              hint={
                data && data.totals.bytes > 0
                  ? `${((companyAttributedBytes / data.totals.bytes) * 100).toFixed(1)}% of total · ${formatBytes(data.unattributed.bytes)} unattributed`
                  : undefined
              }
              loading={loading}
            />
          </div>

          <Card>
            <CardHeader className="border-b py-3 px-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <CardTitle className="text-base font-semibold">Buckets</CardTitle>
                <CardDescription className="text-xs m-0">
                  {loading
                    ? 'Loading…'
                    : `${data?.buckets.length ?? 0} buckets in the AWS account`}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                      ))
                    : (data?.buckets ?? []).map((bucket) =>
                        bucket.objects === 0 ? (
                          <div
                            key={bucket.name}
                            className="flex flex-col items-center gap-2 rounded-lg border p-3 text-center opacity-50"
                          >
                            <Folder className="h-16 w-16 text-muted-foreground" />
                            <div className="min-w-0 w-full">
                              <p className="break-words text-xs font-medium">{bucket.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">Empty</p>
                            </div>
                          </div>
                        ) : (
                          <Link
                            key={bucket.name}
                            href={`/dashboard/aws-analytics/${encodeURIComponent(bucket.name)}`}
                            className="flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:bg-muted/50"
                          >
                            <Folder className="h-16 w-16 text-muted-foreground" />
                            <div className="min-w-0 w-full">
                              <p className="break-words text-xs font-medium">{bucket.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {formatBytes(bucket.bytes)}
                              </p>
                            </div>
                          </Link>
                        )
                      )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <SortableHeader
                        label="Bucket"
                        info={COLUMN_INFO.bucket}
                        sortKey="name"
                        activeKey={bucketSort?.key ?? null}
                        direction={bucketSort?.dir ?? 'asc'}
                        onSort={(key) => setBucketSort((prev) => toggleSort(prev, key))}
                        className="pl-4"
                      />
                      <SortableHeader
                        label="Objects"
                        info={COLUMN_INFO.objects}
                        sortKey="objects"
                        activeKey={bucketSort?.key ?? null}
                        direction={bucketSort?.dir ?? 'asc'}
                        onSort={(key) => setBucketSort((prev) => toggleSort(prev, key))}
                      />
                      <SortableHeader
                        label="Size"
                        info={COLUMN_INFO.size}
                        sortKey="bytes"
                        activeKey={bucketSort?.key ?? null}
                        direction={bucketSort?.dir ?? 'asc'}
                        onSort={(key) => setBucketSort((prev) => toggleSort(prev, key))}
                      />
                      <TableHead className="w-[70px] pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={4} className="py-3">
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      sortedBuckets.map((bucket) => (
                        <TableRow key={bucket.name}>
                          <TableCell className="pl-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{bucket.name}</span>
                              {bucket.truncated && (
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  partial scan
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 tabular-nums text-sm">
                            {formatCompactCount(bucket.objects)}
                          </TableCell>
                          <TableCell className="py-2.5 tabular-nums text-sm">
                            {formatBytes(bucket.bytes)}
                          </TableCell>
                          <TableCell className="py-2.5 pr-4 text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  className="h-7 w-7"
                                  disabled={bucket.objects === 0}
                                  asChild
                                >
                                  <Link
                                    href={`/dashboard/aws-analytics/${encodeURIComponent(bucket.name)}`}
                                    aria-label={`View details for ${bucket.name}`}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                View details
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3 px-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <CardTitle className="text-base font-semibold">Storage by company</CardTitle>
                  <CardDescription className="text-xs m-0">
                    {loading
                      ? 'Loading…'
                      : companySearch.trim()
                        ? `${filteredCompanies.length} of ${data?.companies.length ?? 0} companies`
                        : `${data?.companies.length ?? 0} companies with objects in S3`}
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search company name or ID…"
                    className="h-8 pl-9"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {viewMode === 'grid' ? (
                <div className="p-4">
                  {loading ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : paginatedCompanies.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {companySearch.trim()
                        ? `No companies match “${companySearch.trim()}”.`
                        : 'No company-attributed objects found in S3.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                      {paginatedCompanies.map((row) => (
                        <Link
                          key={row.companyId}
                          href={`/dashboard/aws-analytics/company/${encodeURIComponent(row.companyId)}${
                            row.companyName ? `?name=${encodeURIComponent(row.companyName)}` : ''
                          }`}
                          className="flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:bg-muted/50"
                        >
                          <Folder className="h-16 w-16 text-muted-foreground" />
                          <div className="min-w-0 w-full">
                            <p className="break-words text-xs font-medium">
                              {row.companyName ?? 'Unknown company'}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {formatBytes(row.bytes)}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <SortableHeader
                        label="Company"
                        info={COLUMN_INFO.company}
                        sortKey="company"
                        activeKey={companySort?.key ?? null}
                        direction={companySort?.dir ?? 'asc'}
                        onSort={(key) => setCompanySort((prev) => toggleSort(prev, key))}
                        className="pl-4"
                      />
                      <SortableHeader
                        label="Objects"
                        info={COLUMN_INFO.companyObjects}
                        sortKey="objects"
                        activeKey={companySort?.key ?? null}
                        direction={companySort?.dir ?? 'asc'}
                        onSort={(key) => setCompanySort((prev) => toggleSort(prev, key))}
                      />
                      <SortableHeader
                        label="Storage used"
                        info={COLUMN_INFO.companyStorage}
                        sortKey="bytes"
                        activeKey={companySort?.key ?? null}
                        direction={companySort?.dir ?? 'asc'}
                        onSort={(key) => setCompanySort((prev) => toggleSort(prev, key))}
                        className="pr-4"
                      />
                      <TableHead className="w-[70px] pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={4} className="py-3">
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : paginatedCompanies.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-12 text-center text-sm text-muted-foreground"
                        >
                          {companySearch.trim()
                            ? `No companies match “${companySearch.trim()}”.`
                            : 'No company-attributed objects found in S3.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedCompanies.map((row) => (
                        <TableRow key={row.companyId}>
                          <TableCell className="py-2 pl-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate text-sm">
                                  {row.companyName ?? 'Unknown company'}
                                </p>
                                <p className="truncate font-mono text-[10px] text-muted-foreground">
                                  {row.companyId}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 tabular-nums text-sm">
                            {formatCompactCount(row.objects)}
                          </TableCell>
                          <TableCell className="py-2 tabular-nums text-sm">
                            {formatBytes(row.bytes)}
                          </TableCell>
                          <TableCell className="py-2 pr-4 text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  className="h-7 w-7"
                                  asChild
                                >
                                  <Link
                                    href={`/dashboard/aws-analytics/company/${encodeURIComponent(row.companyId)}${
                                      row.companyName
                                        ? `?name=${encodeURIComponent(row.companyName)}`
                                        : ''
                                    }`}
                                    aria-label={`View details for ${row.companyName ?? row.companyId}`}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                View details
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
              {!loading && filteredCompanies.length > 0 && (
                <div className="border-t px-4 py-3">
                  <AdminActivityPagination
                    page={companyPage}
                    totalPages={companyTotalPages}
                    total={filteredCompanies.length}
                    limit={companyLimit}
                    loading={loading}
                    compact={false}
                    onPageChange={setCompanyPage}
                    onLimitChange={setCompanyLimit}
                  />
                </div>
              )}
              {!loading && data && (
                <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                  {formatBytes(data.unattributed.bytes)} across{' '}
                  {formatCount(data.unattributed.objects)} objects is not linked to any
                  company (platform assets, sample templates, system files, and archives).
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
