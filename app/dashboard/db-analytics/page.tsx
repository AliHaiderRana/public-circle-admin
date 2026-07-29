"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Database,
  Eye,
  FileStack,
  HardDrive,
  Key,
  Layers,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes, formatCompactCount, formatCount } from "./format";
import { StatCard } from "./StatCard";

type ClusterDatabaseOption = {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
};

type ClusterDatabaseRow = {
  name: string;
  collections: number;
  indexes: number;
  objects: number;
  dataSize: number;
  storageSize: number;
  indexSize: number;
  totalSize: number;
  error?: string;
};

type ClusterWideStats = {
  databases: number;
  collections: number;
  objects: number;
  dataSize: number;
  storageSize: number;
  indexSize: number;
  totalSize: number;
  failedDatabases: string[];
  perDatabase: ClusterDatabaseRow[];
};

export default function DbAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [clusterDatabases, setClusterDatabases] = useState<
    ClusterDatabaseOption[]
  >([]);
  const [clusterName, setClusterName] = useState<string | null>(null);
  const [clusterStats, setClusterStats] = useState<ClusterWideStats | null>(
    null,
  );
  const [clusterStatsLoading, setClusterStatsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  const fetchDatabases = useCallback(async () => {
    setClusterStatsLoading(true);
    try {
      const res = await fetch("/api/db-analytics/databases");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      setClusterDatabases(json.databases ?? []);
      setClusterName(json.cluster ?? null);
      setClusterStats(json.clusterStats ?? null);
    } catch {
      setClusterDatabases([]);
      setClusterStats(null);
    } finally {
      setClusterStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin) {
      void fetchDatabases();
    }
  }, [authLoading, user, fetchDatabases]);

  const openDatabase = useCallback(
    (name: string) => {
      router.push(`/dashboard/db-analytics/database/${encodeURIComponent(name)}`);
    },
    [router],
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
          </h1>
          <p className="text-sm text-muted-foreground">
            Storage, document, and index breakdown across{" "}
            {clusterDatabases.length || "…"} databases on this cluster.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          onClick={() => void fetchDatabases()}
          disabled={clusterStatsLoading}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", clusterStatsLoading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      <Card className="bg-muted/20">
        <CardHeader className="py-3 px-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <CardTitle className="text-sm font-semibold">
                Cluster overview
              </CardTitle>
              {clusterName && (
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-normal"
                >
                  {clusterName}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs m-0">
              Combined totals across all {clusterStats?.databases ?? clusterDatabases.length}{" "}
              databases on this cluster
              {clusterStats && clusterStats.failedDatabases.length > 0
                ? ` (${clusterStats.failedDatabases.length} unreachable, excluded)`
                : ""}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={HardDrive}
            label="Total size (billed usage)"
            value={formatBytes(clusterStats?.totalSize ?? 0)}
            hint={
              clusterStats
                ? `${formatBytes(clusterStats.dataSize)} data · ${formatBytes(clusterStats.indexSize)} indexes`
                : undefined
            }
            loading={clusterStatsLoading}
          />
          <StatCard
            icon={FileStack}
            label="Data size"
            value={formatBytes(clusterStats?.dataSize ?? 0)}
            hint={
              clusterStats && clusterStats.storageSize > 0
                ? `${(clusterStats.dataSize / clusterStats.storageSize).toFixed(1)}× compression ratio`
                : undefined
            }
            loading={clusterStatsLoading}
          />
          <StatCard
            icon={Layers}
            label="Documents"
            value={formatCount(clusterStats?.objects ?? 0)}
            hint={
              clusterStats
                ? `across ${clusterStats.collections} collections in ${clusterStats.databases} databases`
                : undefined
            }
            loading={clusterStatsLoading}
          />
          <StatCard
            icon={Key}
            label="Total index size"
            value={formatBytes(clusterStats?.indexSize ?? 0)}
            loading={clusterStatsLoading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold">
            Databases on this cluster
          </CardTitle>
          <CardDescription className="text-xs m-0">
            Click view to see the collections in that database.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Database name</TableHead>
                <TableHead>Storage size</TableHead>
                <TableHead>Data size</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Collections</TableHead>
                <TableHead>Indexes</TableHead>
                <TableHead>Total index size</TableHead>
                <TableHead className="w-[70px] pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusterStatsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="py-3">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !clusterStats || clusterStats.perDatabase.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No databases found.
                  </TableCell>
                </TableRow>
              ) : (
                clusterStats.perDatabase.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="pl-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{row.name}</span>
                        {row.error && (
                          <Badge variant="destructive" className="text-[10px] font-normal">
                            stats unavailable
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {formatBytes(row.storageSize)}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {formatBytes(row.dataSize)}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {formatCompactCount(row.objects)}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {row.collections}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {row.indexes}
                    </TableCell>
                    <TableCell className="py-2.5 tabular-nums text-sm">
                      {formatBytes(row.indexSize)}
                    </TableCell>
                    <TableCell className="py-2.5 pr-4 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="h-7 w-7"
                            onClick={() => openDatabase(row.name)}
                            aria-label={`View collections in ${row.name}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          View collections
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
