'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ViewToggle } from '@/components/aws-analytics/ViewToggle';
import { useAwsViewMode } from '@/hooks/use-aws-view-mode';
import { ArrowLeft, Building2, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes, formatCompactCount, formatCount } from '../../../db-analytics/format';

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

function CompanyAwsDetailContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const searchParams = useSearchParams();

  const companyId = decodeURIComponent(params.companyId ?? '');
  const nameHint = searchParams.get('name') || '';

  const [company, setCompany] = useState<CompanyUsageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useAwsViewMode();

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchCompany = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/aws-analytics/company?id=${encodeURIComponent(companyId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load company usage');
      setCompany(json.company);
    } catch (err) {
      setCompany(null);
      setError(err instanceof Error ? err.message : 'Failed to load company usage');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin && companyId) {
      void fetchCompany();
    }
  }, [authLoading, user, companyId, fetchCompany]);

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const displayName = company?.companyName ?? nameHint ?? 'Unknown company';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 h-8" asChild>
            <Link href="/dashboard/aws-analytics">
              <ArrowLeft className="h-4 w-4" />
              AWS Analytics
            </Link>
          </Button>
          <span className="hidden sm:inline text-muted-foreground">/</span>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Building2 className="size-5 text-muted-foreground" />
            {displayName}
          </h1>
          <span className="font-mono text-xs text-muted-foreground">{companyId}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void fetchCompany()}
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
            <Button type="button" size="sm" onClick={() => void fetchCompany()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading || !company ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total storage used</p>
                <p className="text-lg font-semibold tabular-nums">{formatBytes(company.bytes)}</p>
                <p className="text-[11px] text-muted-foreground">
                  across {company.buckets.length} bucket{company.buckets.length === 1 ? '' : 's'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total files</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCount(company.objects)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {company.buckets.map((usage) => {
                    const browseQs = new URLSearchParams({
                      company: company.companyId,
                      companyName: displayName,
                    });
                    return (
                      <Link
                        key={usage.bucket}
                        href={`/dashboard/aws-analytics/${encodeURIComponent(usage.bucket)}?${browseQs}`}
                        className="flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:bg-muted/50"
                      >
                        <Folder className="h-16 w-16 text-muted-foreground" />
                        <div className="min-w-0 w-full">
                          <p className="break-words text-xs font-medium">{usage.bucket}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {formatBytes(usage.bytes)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Bucket</TableHead>
                      <TableHead className="text-right">Files</TableHead>
                      <TableHead className="text-right">Storage</TableHead>
                      <TableHead className="w-[60px] text-right">Share</TableHead>
                      <TableHead className="w-[70px] pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.buckets.map((usage) => {
                      const share = company.bytes > 0 ? (usage.bytes / company.bytes) * 100 : 0;
                      const browseQs = new URLSearchParams({
                        company: company.companyId,
                        companyName: displayName,
                      });
                      return (
                        <TableRow key={usage.bucket}>
                          <TableCell className="py-2 pl-4 text-sm">{usage.bucket}</TableCell>
                          <TableCell className="py-2 text-right tabular-nums text-sm">
                            {formatCompactCount(usage.objects)}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums text-sm">
                            {formatBytes(usage.bytes)}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums text-xs text-muted-foreground">
                            {share.toFixed(0)}%
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
                                    href={`/dashboard/aws-analytics/${encodeURIComponent(usage.bucket)}?${browseQs}`}
                                    aria-label={`Browse files in ${usage.bucket}`}
                                  >
                                    <FolderOpen className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Browse files
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function CompanyAwsDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <CompanyAwsDetailContent />
    </Suspense>
  );
}
