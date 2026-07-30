'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Archive, ArchiveRestore, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RestoreCompanyDialog, type ArchivedCompanyRow } from '@/components/RestoreCompanyDialog';

function statusBadgeVariant(status: ArchivedCompanyRow['status']) {
  if (status === 'restored') return 'secondary' as const;
  if (status === 'restore_failed') return 'destructive' as const;
  return 'outline' as const;
}

export default function ArchivedCompaniesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ArchivedCompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ArchivedCompanyRow | null>(null);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/companies/archived');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load archived companies');
      setRows(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load archived companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin) {
      void fetchArchived();
    }
  }, [authLoading, user, fetchArchived]);

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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 h-8" asChild>
            <Link href="/dashboard/companies">
              <ArrowLeft className="h-4 w-4" />
              Companies
            </Link>
          </Button>
          <span className="hidden sm:inline text-muted-foreground">/</span>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Archive className="size-5 text-muted-foreground" />
            Archived Companies
          </h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => void fetchArchived()}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Companies</CardTitle>
          <CardDescription>
            Backed up to AWS and removed from live data. Restore recreates the database
            documents, S3 files, and Stripe subscription(s).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Company</TableHead>
                <TableHead>Archived</TableHead>
                <TableHead>Archived by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px] pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="py-3">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    No archived companies.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="pl-4 py-2.5 text-sm font-medium">
                      {row.companyName}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-muted-foreground">
                      {new Date(row.archivedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-muted-foreground">
                      {row.archivedBy}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant={statusBadgeVariant(row.status)} className="font-normal">
                        {row.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 pr-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-7"
                        disabled={row.status === 'restored'}
                        onClick={() => setRestoreTarget(row)}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {restoreTarget && (
        <RestoreCompanyDialog
          open={Boolean(restoreTarget)}
          onOpenChange={(next) => !next && setRestoreTarget(null)}
          archived={restoreTarget}
          onQueued={() => {
            setRestoreTarget(null);
          }}
        />
      )}
    </div>
  );
}
