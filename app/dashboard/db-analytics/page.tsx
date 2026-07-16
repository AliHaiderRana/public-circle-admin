'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Database,
  FileStack,
  Gauge,
  HardDrive,
  Layers,
  RefreshCw,
  Scale,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes, formatCount, type CollectionAnalytics } from './format';

type DatabaseAnalytics = {
  name: string;
  collections: number;
  views: number;
  objects: number;
  avgObjSize: number;
  dataSize: number;
  storageSize: number;
  indexes: number;
  indexSize: number;
  totalSize: number;
  fsUsedSize: number;
  fsTotalSize: number;
};

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

export default function DbAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [database, setDatabase] = useState<DatabaseAnalytics | null>(null);
  const [collections, setCollections] = useState<CollectionAnalytics[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/db-analytics');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load database analytics');
      setDatabase(json.database ?? null);
      setCollections(json.collections ?? []);
      setGeneratedAt(json.generatedAt ?? null);
    } catch (err) {
      setDatabase(null);
      setCollections([]);
      setError(err instanceof Error ? err.message : 'Failed to load database analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin) {
      void fetchAnalytics();
    }
  }, [authLoading, user, fetchAnalytics]);

  const grandTotalSize = useMemo(
    () => collections.reduce((sum, c) => sum + c.storageSize + c.totalIndexSize, 0),
    [collections]
  );

  const filteredCollections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((c) => c.name.toLowerCase().includes(q));
  }, [collections, search]);

  const diskUsagePct = useMemo(() => {
    if (!database?.fsTotalSize) return null;
    return Math.min(100, (database.fsUsedSize / database.fsTotalSize) * 100);
  }, [database]);

  const openCollection = useCallback(
    (name: string) => {
      router.push(`/dashboard/db-analytics/${encodeURIComponent(name)}`);
    },
    [router]
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
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Database className="size-5 text-muted-foreground" />
            Database Analytics
            {database?.name && (
              <Badge variant="outline" className="font-mono text-xs font-normal">
                {database.name}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Storage, document, and index breakdown per collection.
            {generatedAt && ` Snapshot taken ${new Date(generatedAt).toLocaleTimeString()}.`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          onClick={() => void fetchAnalytics()}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={HardDrive}
          label="Total size (data + indexes)"
          value={formatBytes(database?.totalSize ?? 0)}
          hint={
            database
              ? `${formatBytes(database.storageSize)} storage · ${formatBytes(database.indexSize)} indexes`
              : undefined
          }
          loading={loading}
        />
        <StatCard
          icon={FileStack}
          label="Uncompressed data size"
          value={formatBytes(database?.dataSize ?? 0)}
          hint={
            database && database.storageSize > 0
              ? `${(database.dataSize / database.storageSize).toFixed(1)}× compression ratio`
              : undefined
          }
          loading={loading}
        />
        <StatCard
          icon={Layers}
          label="Documents"
          value={formatCount(database?.objects ?? 0)}
          hint={
            database
              ? `across ${database.collections} collection${database.collections === 1 ? '' : 's'}`
              : undefined
          }
          loading={loading}
        />
        <StatCard
          icon={Scale}
          label="Avg document size"
          value={formatBytes(database?.avgObjSize ?? 0)}
          hint={database ? `${database.indexes} indexes total` : undefined}
          loading={loading}
        />
      </div>

      {diskUsagePct !== null && database && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Gauge className="size-4 text-muted-foreground" />
                Disk usage on database server
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatBytes(database.fsUsedSize)} of {formatBytes(database.fsTotalSize)} (
                {diskUsagePct.toFixed(1)}%)
              </span>
            </div>
            <Progress value={diskUsagePct} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b py-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <CardTitle className="text-base font-semibold">Collections</CardTitle>
              <CardDescription className="text-xs m-0">
                {loading
                  ? 'Loading…'
                  : search.trim()
                    ? `${filteredCollections.length} of ${collections.length} collections`
                    : `${collections.length} collections · click a row for details`}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search collections…"
                className="h-8 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Collection</TableHead>
                <TableHead className="text-right">Documents</TableHead>
                <TableHead className="text-right">Data size</TableHead>
                <TableHead className="text-right">Avg object</TableHead>
                <TableHead className="text-right">Storage</TableHead>
                <TableHead className="text-right">Indexes</TableHead>
                <TableHead className="text-right">Index size</TableHead>
                <TableHead className="w-[180px] pr-4">Share of total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="py-3">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <p className="text-sm font-medium text-destructive">{error}</p>
                      <Button type="button" size="sm" onClick={() => void fetchAnalytics()}>
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredCollections.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {search.trim()
                      ? `No collections match “${search.trim()}”.`
                      : 'No collections found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCollections.map((col) => {
                  const colTotal = col.storageSize + col.totalIndexSize;
                  const share = grandTotalSize > 0 ? (colTotal / grandTotalSize) * 100 : 0;
                  return (
                    <TableRow
                      key={col.name}
                      className="cursor-pointer"
                      onClick={() => openCollection(col.name)}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${col.name}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openCollection(col.name);
                        }
                      }}
                    >
                      <TableCell className="pl-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{col.name}</span>
                          {col.capped && (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              capped
                            </Badge>
                          )}
                          {col.error && (
                            <Badge variant="destructive" className="text-[10px] font-normal">
                              stats unavailable
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm">
                        {formatCount(col.count)}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm">
                        {formatBytes(col.size)}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm">
                        {formatBytes(col.avgObjSize)}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm">
                        {formatBytes(col.storageSize)}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm">
                        {col.nindexes}
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm">
                        {formatBytes(col.totalIndexSize)}
                      </TableCell>
                      <TableCell className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <Progress value={share} className="h-1.5 flex-1" />
                          <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
