"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Database,
  Eye,
  FileStack,
  Gauge,
  HardDrive,
  Info,
  Key,
  Layers,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatBytes,
  formatCompactCount,
  formatCount,
  type CollectionAnalytics,
} from "../../format";
import { StatCard } from "../../StatCard";

const COLUMN_INFO = {
  collectionName: "Name of the MongoDB collection.",
  storageSize:
    "Disk space the documents occupy after WiredTiger compression. Excludes indexes.",
  dataSize:
    "Uncompressed size of all documents (sum of their BSON sizes) — the logical amount of data stored.",
  documents: "Number of documents in the collection.",
  avgDocumentSize:
    "Average uncompressed document size: data size divided by the number of documents.",
  indexes: "Number of indexes defined on the collection.",
  totalIndexSize:
    "Disk space used by all of the collection’s indexes combined.",
} as const;

function HeaderWithInfo({ label, info }: { label: string; info: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="cursor-help"
            aria-label={`About ${label}`}
          >
            <Info className="h-3 w-3 text-muted-foreground/70" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs">
          {info}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

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

export default function DbDatabaseDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const databaseName = decodeURIComponent(params.name ?? "");

  const [database, setDatabase] = useState<DatabaseAnalytics | null>(null);
  const [collections, setCollections] = useState<CollectionAnalytics[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/db-analytics?database=${encodeURIComponent(databaseName)}`,
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.error || "Failed to load database analytics");
      setDatabase(json.database ?? null);
      setCollections(json.collections ?? []);
      setGeneratedAt(json.generatedAt ?? null);
    } catch (err) {
      setDatabase(null);
      setCollections([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load database analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [databaseName]);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin && databaseName) {
      void fetchAnalytics();
    }
  }, [authLoading, user, databaseName, fetchAnalytics]);

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
      const qs = new URLSearchParams({ database: databaseName });
      router.push(`/dashboard/db-analytics/${encodeURIComponent(name)}?${qs}`);
    },
    [router, databaseName],
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
            <Link href="/dashboard/db-analytics">
              <ArrowLeft className="h-4 w-4" />
              DB Analytics
            </Link>
          </Button>
          <span className="hidden sm:inline text-muted-foreground">/</span>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Database className="size-5 text-muted-foreground" />
            <span className="font-mono">{databaseName}</span>
          </h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          onClick={() => void fetchAnalytics()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
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
                {formatBytes(database.fsUsedSize)} of{" "}
                {formatBytes(database.fsTotalSize)} ({diskUsagePct.toFixed(1)}%)
              </span>
            </div>
            <Progress value={diskUsagePct} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <CardTitle className="text-base font-semibold">
                Collections
              </CardTitle>
              {generatedAt && !loading && (
                <CardDescription className="text-xs m-0">
                  Snapshot taken {new Date(generatedAt).toLocaleTimeString()}
                </CardDescription>
              )}
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
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={HardDrive}
              label="Total size (billed usage)"
              value={formatBytes(database?.totalSize ?? 0)}
              hint={
                database
                  ? `${formatBytes(database.dataSize)} data · ${formatBytes(database.indexSize)} indexes`
                  : undefined
              }
              loading={loading}
            />
            <StatCard
              icon={FileStack}
              label="Data size"
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
                  ? `across ${database.collections} collection${database.collections === 1 ? "" : "s"}`
                  : undefined
              }
              loading={loading}
            />
            <StatCard
              icon={Key}
              label="Total index size"
              value={formatBytes(database?.indexSize ?? 0)}
              hint={database ? `${database.indexes} indexes total` : undefined}
              loading={loading}
            />
          </div>

          <Separator />

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">
                  <HeaderWithInfo
                    label="Collection name"
                    info={COLUMN_INFO.collectionName}
                  />
                </TableHead>
                <TableHead>
                  <HeaderWithInfo
                    label="Storage size"
                    info={COLUMN_INFO.storageSize}
                  />
                </TableHead>
                <TableHead>
                  <HeaderWithInfo
                    label="Data size"
                    info={COLUMN_INFO.dataSize}
                  />
                </TableHead>
                <TableHead>
                  <HeaderWithInfo
                    label="Documents"
                    info={COLUMN_INFO.documents}
                  />
                </TableHead>
                <TableHead>
                  <HeaderWithInfo
                    label="Avg. document size"
                    info={COLUMN_INFO.avgDocumentSize}
                  />
                </TableHead>
                <TableHead>
                  <HeaderWithInfo label="Indexes" info={COLUMN_INFO.indexes} />
                </TableHead>
                <TableHead>
                  <HeaderWithInfo
                    label="Total index size"
                    info={COLUMN_INFO.totalIndexSize}
                  />
                </TableHead>
                <TableHead className="w-[70px] pr-4 text-right">
                  Actions
                </TableHead>
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
                      <p className="text-sm font-medium text-destructive">
                        {error}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void fetchAnalytics()}
                      >
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
                      : "No collections found."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCollections.map((col) => (
                  <TableRow key={col.name}>
                    <TableCell className="pl-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{col.name}</span>
                        {col.capped && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-normal"
                          >
                            capped
                          </Badge>
                        )}
                        {col.error && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] font-normal"
                          >
                            stats unavailable
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {formatBytes(col.storageSize)}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {formatBytes(col.size)}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {formatCompactCount(col.count)}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {formatBytes(col.avgObjSize)}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {col.nindexes}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {formatBytes(col.totalIndexSize)}
                    </TableCell>
                    <TableCell className="py-2.5 pr-4 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="h-7 w-7"
                            onClick={() => openCollection(col.name)}
                            aria-label={`View details for ${col.name}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
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
        </CardContent>
      </Card>
    </div>
  );
}
