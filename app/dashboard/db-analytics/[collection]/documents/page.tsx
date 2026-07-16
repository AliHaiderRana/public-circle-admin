'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AdminActivityPagination from '@/components/AdminActivityPagination';
import { ArrowLeft, Building2, ChevronRight, FileJson, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes, formatCount } from '../../format';

const DOC_JSON_TRUNCATE_AT = 20_000;

function DocumentRow({ doc }: { doc: Record<string, unknown> }) {
  const id = doc._id != null ? String(doc._id) : '(no _id)';
  const sizeBytes = typeof doc.__sizeBytes === 'number' ? doc.__sizeBytes : null;
  const json = useMemo(() => {
    const { __sizeBytes: _omit, ...rest } = doc;
    const full = JSON.stringify(rest, null, 2);
    if (full.length <= DOC_JSON_TRUNCATE_AT) return { text: full, truncated: false };
    return { text: full.slice(0, DOC_JSON_TRUNCATE_AT), truncated: true };
  }, [doc]);

  const preview = useMemo(() => {
    const keys = Object.keys(doc).filter((k) => k !== '_id' && k !== '__sizeBytes');
    return keys.slice(0, 6).join(', ') + (keys.length > 6 ? ', …' : '');
  }, [doc]);

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left transition-colors hover:bg-muted/50 [&[data-state=open]>svg]:rotate-90"
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform" />
          <span className="shrink-0 font-mono text-xs">{id}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {preview}
          </span>
          {sizeBytes !== null && (
            <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums">
              {formatBytes(sizeBytes)}
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-96 overflow-y-auto border-b bg-muted/30">
          <pre className="whitespace-pre-wrap break-all p-4 font-mono text-[11px] leading-relaxed">
            {json.text}
          </pre>
        </div>
        {json.truncated && (
          <p className="border-b px-4 py-1.5 text-[11px] text-muted-foreground">
            Output truncated at {formatCount(DOC_JSON_TRUNCATE_AT)} characters.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function CompanyDocumentsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ collection: string }>();
  const searchParams = useSearchParams();

  const collectionName = decodeURIComponent(params.collection ?? '');
  const field = (searchParams.get('field') || '').trim();
  const companyParam = (searchParams.get('company') || '').trim();
  const companyId = companyParam === 'none' ? null : companyParam;
  const companyName = (searchParams.get('companyName') || '').trim();

  const [docs, setDocs] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const missingParams = !field || !companyParam;

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchDocs = useCallback(
    async (nextPage: number, nextLimit: number) => {
      setLoading(true);
      setError(null);
      try {
        const filter = JSON.stringify({ [field]: companyId });
        const qs = new URLSearchParams({
          name: collectionName,
          page: String(nextPage),
          limit: String(nextLimit),
          filter,
        });
        const res = await fetch(`/api/db-analytics/collection/documents?${qs}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load documents');
        setDocs(json.documents ?? []);
        setTotal(json.total ?? 0);
        setPages(json.pages ?? 1);
      } catch (err) {
        setDocs([]);
        setTotal(0);
        setPages(1);
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    },
    [collectionName, field, companyId]
  );

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin && collectionName && !missingParams) {
      void fetchDocs(1, limit);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, collectionName, field, companyParam]);

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const companyLabel = companyName || (companyId ? 'Unknown company' : 'No company');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 h-8" asChild>
            <Link href={`/dashboard/db-analytics/${encodeURIComponent(collectionName)}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="font-mono">{collectionName}</span>
            </Link>
          </Button>
          <span className="hidden sm:inline text-muted-foreground">/</span>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Building2 className="size-5 text-muted-foreground" />
            {companyLabel}
          </h1>
          {companyId && (
            <span className="font-mono text-xs text-muted-foreground">{companyId}</span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          onClick={() => void fetchDocs(page, limit)}
          disabled={loading || missingParams}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
            <div className="flex items-center gap-2">
              <FileJson className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                {loading
                  ? 'Loading documents…'
                  : `${formatCount(total)} document${total === 1 ? '' : 's'}`}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Size shown per document · click a row to expand
            </span>
          </div>

          {missingParams ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Missing company parameters — open this page via the “View” button on a
              collection&apos;s “By company” tab.
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button type="button" size="sm" onClick={() => void fetchDocs(page, limit)}>
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No documents found for this company.
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
                <span className="w-3.5 shrink-0" />
                <span className="shrink-0">Document ID</span>
                <span className="min-w-0 flex-1">Fields</span>
                <span className="w-20 shrink-0 text-right">Size</span>
              </div>
              {docs.map((doc, i) => (
                <DocumentRow key={doc._id != null ? String(doc._id) : i} doc={doc} />
              ))}
            </div>
          )}

          {!missingParams && !error && total > 0 && (
            <div className="px-4 py-3">
              <AdminActivityPagination
                page={page}
                totalPages={pages}
                total={total}
                limit={limit}
                loading={loading}
                compact={false}
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  void fetchDocs(nextPage, limit);
                }}
                onLimitChange={(nextLimit) => {
                  setLimit(nextLimit);
                  setPage(1);
                  void fetchDocs(1, nextLimit);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CompanyDocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <CompanyDocumentsContent />
    </Suspense>
  );
}
