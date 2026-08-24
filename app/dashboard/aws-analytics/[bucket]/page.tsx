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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ViewToggle } from '@/components/aws-analytics/ViewToggle';
import { FilePreviewDialog } from '@/components/aws-analytics/FilePreviewDialog';
import {
  compareValues,
  SortableHeader,
  toggleSort,
  type SortState,
} from '@/components/aws-analytics/SortableHeader';
import { useAwsViewMode } from '@/hooks/use-aws-view-mode';
import {
  ArrowLeft,
  Building2,
  Database,
  Download,
  Eye,
  File,
  FileJson,
  Folder,
  RefreshCw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeAgo, formatTimeAgoShort } from '@/lib/format-time-ago';
import { formatBytes, formatCompactCount, formatCount } from '../../db-analytics/format';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'avif',
  'ico',
]);

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(fileExtension(name));
}

type BrowseSortKey = 'name' | 'items' | 'bytes' | 'createdAt' | 'updatedAt';

function timestamp(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

/** Relative time ("2 hours ago"), with the exact date revealed on hover. */
function DateCell({ iso }: { iso: string | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{formatTimeAgo(iso)}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {formatDate(iso)}
      </TooltipContent>
    </Tooltip>
  );
}

/** Compact relative time for tight spaces (grid tiles), with the exact date on hover. */
function RelativeTimeLabel({ label, iso }: { label: string; iso: string | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help truncate">
          {label} {formatTimeAgoShort(iso)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {formatDate(iso)}
      </TooltipContent>
    </Tooltip>
  );
}

function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  if (fileExtension(name) === 'json') {
    return <FileJson className={className} />;
  }
  return <File className={className} />;
}

type BrowseFolder = {
  name: string;
  prefix: string;
  objects: number;
  bytes: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type BrowseFile = {
  name: string;
  key: string;
  bytes: number;
  lastModified: string | null;
};

type BrowseResult = {
  bucket: string;
  prefix: string;
  folders: BrowseFolder[];
  files: BrowseFile[];
  truncated: boolean;
};

function BucketBrowserContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ bucket: string }>();
  const searchParams = useSearchParams();

  const bucketName = decodeURIComponent(params.bucket ?? '');
  const prefix = searchParams.get('prefix') || '';
  const companyFilter = searchParams.get('company') || '';
  const companyName = searchParams.get('companyName') || '';

  const [data, setData] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useAwsViewMode();
  const [browseSort, setBrowseSort] = useState<SortState<BrowseSortKey>>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [thumbErrors, setThumbErrors] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<BrowseFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchBrowse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ bucket: bucketName, prefix });
      if (companyFilter) qs.set('company', companyFilter);
      const res = await fetch(`/api/aws-analytics/browse?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load folder contents');
      setData(json);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load folder contents');
    } finally {
      setLoading(false);
    }
  }, [bucketName, prefix, companyFilter]);

  // Grid view shows image thumbnails — fetch presigned view URLs for the
  // image files in the current folder once, so far-untouched files (JSON,
  // PDFs, etc.) never trigger an extra request.
  useEffect(() => {
    if (viewMode !== 'grid' || !data) return;
    const pending = data.files.filter((f) => isImageFile(f.name) && !thumbUrls[f.key]);
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        pending.slice(0, 120).map(async (f) => {
          try {
            const qs = new URLSearchParams({ bucket: bucketName, key: f.key });
            const res = await fetch(`/api/aws-analytics/file-url?${qs}`);
            const json = await res.json();
            if (!res.ok) return null;
            return [f.key, json.url] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setThumbUrls((prev) => {
        const next = { ...prev };
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // thumbUrls is read for a same-tick membership check, not a trigger —
    // including it would refetch every time a URL is added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, data, bucketName]);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin && bucketName) {
      void fetchBrowse();
    }
  }, [authLoading, user, bucketName, fetchBrowse]);

  const buildHref = useCallback(
    (nextPrefix: string, keepCompanyFilter: boolean) => {
      const qs = new URLSearchParams();
      if (nextPrefix) qs.set('prefix', nextPrefix);
      if (keepCompanyFilter && companyFilter) {
        qs.set('company', companyFilter);
        if (companyName) qs.set('companyName', companyName);
      }
      const query = qs.toString();
      return `/dashboard/aws-analytics/${encodeURIComponent(bucketName)}${query ? `?${query}` : ''}`;
    },
    [bucketName, companyFilter, companyName]
  );

  const openFolder = useCallback(
    (folderPrefix: string) => {
      router.push(buildHref(folderPrefix, true));
    },
    [router, buildHref]
  );

  const openFile = useCallback(
    async (file: BrowseFile) => {
      setOpeningKey(file.key);
      setOpenError(null);
      setPreviewFile(file);
      setPreviewUrl(null);
      setPreviewError(null);
      setPreviewLoading(true);
      setPreviewOpen(true);
      try {
        const qs = new URLSearchParams({ bucket: bucketName, key: file.key });
        const res = await fetch(`/api/aws-analytics/file-url?${qs}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to open file');
        setPreviewUrl(json.url);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : 'Failed to open file');
      } finally {
        setOpeningKey(null);
        setPreviewLoading(false);
      }
    },
    [bucketName]
  );

  const downloadFile = useCallback(
    async (file: BrowseFile) => {
      setDownloadingKey(file.key);
      setOpenError(null);
      try {
        const qs = new URLSearchParams({ bucket: bucketName, key: file.key, download: '1' });
        const res = await fetch(`/api/aws-analytics/file-url?${qs}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to download file');
        // Content-Disposition on the presigned URL makes the browser save it
        // rather than navigate — trigger via a hidden link, no new tab needed.
        const link = document.createElement('a');
        link.href = json.url;
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        setOpenError(err instanceof Error ? err.message : 'Failed to download file');
      } finally {
        setDownloadingKey(null);
      }
    },
    [bucketName]
  );

  // Breadcrumb segments derived from the prefix, each clickable
  const breadcrumbs = useMemo(() => {
    const trimmed = prefix.replace(/\/$/, '');
    if (!trimmed) return [];
    const parts = trimmed.split('/');
    let running = '';
    return parts.map((part) => {
      running += `${part}/`;
      return { label: part, prefix: running };
    });
  }, [prefix]);

  const parentPrefix = useMemo(() => {
    if (breadcrumbs.length <= 1) return '';
    return breadcrumbs[breadcrumbs.length - 2].prefix;
  }, [breadcrumbs]);

  const sortedFolders = useMemo(() => {
    const rows = data?.folders ?? [];
    if (!browseSort) return rows;
    return [...rows].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (browseSort.key) {
        case 'name':
          av = a.name;
          bv = b.name;
          break;
        case 'items':
          av = a.objects;
          bv = b.objects;
          break;
        case 'bytes':
          av = a.bytes;
          bv = b.bytes;
          break;
        case 'createdAt':
          av = timestamp(a.createdAt);
          bv = timestamp(b.createdAt);
          break;
        case 'updatedAt':
          av = timestamp(a.updatedAt);
          bv = timestamp(b.updatedAt);
          break;
      }
      return compareValues(av, bv, browseSort.dir);
    });
  }, [data, browseSort]);

  const sortedFiles = useMemo(() => {
    const rows = data?.files ?? [];
    if (!browseSort) return rows;
    return [...rows].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (browseSort.key) {
        case 'name':
          av = a.name;
          bv = b.name;
          break;
        case 'items':
          av = 0;
          bv = 0;
          break;
        case 'bytes':
          av = a.bytes;
          bv = b.bytes;
          break;
        case 'createdAt':
        case 'updatedAt':
          av = timestamp(a.lastModified);
          bv = timestamp(b.lastModified);
          break;
      }
      return compareValues(av, bv, browseSort.dir);
    });
  }, [data, browseSort]);

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const isEmpty = !loading && !error && (data?.folders.length ?? 0) === 0 && (data?.files.length ?? 0) === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 min-w-0">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 h-8 shrink-0" asChild>
            <Link href="/dashboard/aws-analytics">
              <ArrowLeft className="h-4 w-4" />
              AWS Analytics
            </Link>
          </Button>
          <span className="hidden sm:inline text-muted-foreground">/</span>
          <div className="flex flex-wrap items-center gap-1 min-w-0 text-sm">
            <button
              type="button"
              className="flex items-center gap-1.5 font-semibold hover:underline"
              onClick={() => openFolder('')}
            >
              <Database className="size-4 text-muted-foreground" />
              {bucketName}
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.prefix} className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-medium">{crumb.label}</span>
                ) : (
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => openFolder(crumb.prefix)}
                  >
                    {crumb.label}
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void fetchBrowse()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {companyFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <Badge variant="secondary" className="gap-1.5 font-normal">
            <Building2 className="h-3 w-3" />
            Showing only files for {companyName || companyFilter}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            asChild
          >
            <Link href={buildHref(prefix, false)}>
              <X className="h-3 w-3" />
              Clear filter
            </Link>
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {breadcrumbs.length > 0 && (
            <div className="border-b px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs -ml-2"
                onClick={() => openFolder(parentPrefix)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Up one level
              </Button>
            </div>
          )}

          {openError && (
            <p className="border-b px-4 py-2 text-sm text-destructive">{openError}</p>
          )}

          {viewMode === 'grid' ? (
            <div className="p-4">
              {loading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm font-medium text-destructive">{error}</p>
                  <Button type="button" size="sm" onClick={() => void fetchBrowse()}>
                    Retry
                  </Button>
                </div>
              ) : isEmpty ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {companyFilter
                    ? 'No files for this company in this folder.'
                    : 'This folder is empty.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {(data?.folders ?? []).map((folder) => (
                    <button
                      key={folder.prefix}
                      type="button"
                      onClick={() => openFolder(folder.prefix)}
                      className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors hover:bg-muted/60"
                    >
                      <Folder className="h-16 w-16 shrink-0 text-muted-foreground" />
                      <span className="w-full break-words text-xs font-medium">{folder.name}</span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {formatCompactCount(folder.objects)} items · {formatBytes(folder.bytes)}
                      </span>
                      <span className="flex w-full justify-center text-[10px] text-muted-foreground">
                        <RelativeTimeLabel label="Created" iso={folder.createdAt} />
                      </span>
                      <span className="flex w-full justify-center text-[10px] text-muted-foreground">
                        <RelativeTimeLabel label="Updated" iso={folder.updatedAt} />
                      </span>
                    </button>
                  ))}
                  {(data?.files ?? []).map((file) => {
                    const showImage =
                      isImageFile(file.name) && thumbUrls[file.key] && !thumbErrors.has(file.key);
                    const showImageLoading =
                      isImageFile(file.name) && !thumbUrls[file.key] && !thumbErrors.has(file.key);
                    return (
                      <div
                        key={file.key}
                        className="group relative flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors hover:bg-muted/60"
                      >
                        <button
                          type="button"
                          onClick={() => void openFile(file)}
                          disabled={openingKey === file.key}
                          className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md bg-muted/40"
                          aria-label={`Open ${file.name}`}
                        >
                          {showImage ? (
                            // Presigned S3 URL — plain img avoids next/image's
                            // remote-domain allowlisting for a signed, short-lived URL.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumbUrls[file.key]}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={() =>
                                setThumbErrors((prev) => new Set(prev).add(file.key))
                              }
                            />
                          ) : showImageLoading ? (
                            <Skeleton className="h-full w-full rounded-md" />
                          ) : (
                            <FileTypeIcon name={file.name} className="h-12 w-12 text-muted-foreground" />
                          )}
                        </button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void downloadFile(file);
                              }}
                              disabled={downloadingKey === file.key}
                              className="absolute right-1 top-1 hidden size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground group-hover:flex"
                              aria-label={`Download ${file.name}`}
                            >
                              <Download className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Download
                          </TooltipContent>
                        </Tooltip>
                        <span className="w-full break-words text-xs">{file.name}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {formatBytes(file.bytes)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader
                  label="Name"
                  sortKey="name"
                  activeKey={browseSort?.key ?? null}
                  direction={browseSort?.dir ?? 'asc'}
                  onSort={(key) => setBrowseSort((prev) => toggleSort(prev, key))}
                  className="pl-4"
                />
                <SortableHeader
                  label="Items"
                  sortKey="items"
                  activeKey={browseSort?.key ?? null}
                  direction={browseSort?.dir ?? 'asc'}
                  onSort={(key) => setBrowseSort((prev) => toggleSort(prev, key))}
                  align="right"
                />
                <SortableHeader
                  label="Size"
                  sortKey="bytes"
                  activeKey={browseSort?.key ?? null}
                  direction={browseSort?.dir ?? 'asc'}
                  onSort={(key) => setBrowseSort((prev) => toggleSort(prev, key))}
                  className="pr-6"
                  align="right"
                />
                <SortableHeader
                  label="Created At"
                  sortKey="createdAt"
                  activeKey={browseSort?.key ?? null}
                  direction={browseSort?.dir ?? 'asc'}
                  onSort={(key) => setBrowseSort((prev) => toggleSort(prev, key))}
                  className="pl-4"
                />
                <SortableHeader
                  label="Updated At"
                  sortKey="updatedAt"
                  activeKey={browseSort?.key ?? null}
                  direction={browseSort?.dir ?? 'asc'}
                  onSort={(key) => setBrowseSort((prev) => toggleSort(prev, key))}
                  className="pl-4"
                />
                <TableHead className="w-[90px] pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="py-3">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <p className="text-sm font-medium text-destructive">{error}</p>
                      <Button type="button" size="sm" onClick={() => void fetchBrowse()}>
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isEmpty ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {companyFilter
                      ? 'No files for this company in this folder.'
                      : 'This folder is empty.'}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sortedFolders.map((folder) => (
                    <TableRow
                      key={folder.prefix}
                      className="cursor-pointer"
                      onClick={() => openFolder(folder.prefix)}
                    >
                      <TableCell className="pl-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Folder className="size-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm">{folder.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums text-sm text-muted-foreground">
                        {formatCompactCount(folder.objects)}
                      </TableCell>
                      <TableCell className="py-2.5 pr-6 text-right tabular-nums text-sm">
                        {formatBytes(folder.bytes)}
                      </TableCell>
                      <TableCell className="py-2.5 pl-4 text-sm text-muted-foreground whitespace-nowrap">
                        <DateCell iso={folder.createdAt} />
                      </TableCell>
                      <TableCell className="py-2.5 pl-4 text-sm text-muted-foreground whitespace-nowrap">
                        <DateCell iso={folder.updatedAt} />
                      </TableCell>
                      <TableCell className="py-2.5 pr-4 text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFolder(folder.prefix);
                              }}
                              aria-label={`Open folder ${folder.name}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Open folder
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedFiles.map((file) => (
                    <TableRow
                      key={file.key}
                      className="cursor-pointer"
                      onClick={() => void openFile(file)}
                    >
                      <TableCell className="pl-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <File className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm">{file.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-sm text-muted-foreground">
                        —
                      </TableCell>
                      <TableCell className="py-2.5 pr-6 text-right tabular-nums text-sm">
                        {formatBytes(file.bytes)}
                      </TableCell>
                      <TableCell className="py-2.5 pl-4 text-sm text-muted-foreground whitespace-nowrap">
                        <DateCell iso={file.lastModified} />
                      </TableCell>
                      <TableCell className="py-2.5 pl-4 text-sm text-muted-foreground whitespace-nowrap">
                        <DateCell iso={file.lastModified} />
                      </TableCell>
                      <TableCell className="py-2.5 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openFile(file);
                                }}
                                disabled={openingKey === file.key}
                                aria-label={`Preview ${file.name}`}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {openingKey === file.key ? 'Opening…' : 'Preview'}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void downloadFile(file);
                                }}
                                disabled={downloadingKey === file.key}
                                aria-label={`Download ${file.name}`}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {downloadingKey === file.key ? 'Downloading…' : 'Download'}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
          )}

          {!loading && !error && data?.truncated && (
            <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
              This folder is very large — showing a partial listing.
            </p>
          )}

          {!loading && !error && data && !isEmpty && (
            <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
              {formatCount(data.folders.length)} folder{data.folders.length === 1 ? '' : 's'} ·{' '}
              {formatCount(data.files.length)} file{data.files.length === 1 ? '' : 's'} at this
              level
            </p>
          )}
        </CardContent>
      </Card>

      <FilePreviewDialog
        open={previewOpen}
        onOpenChange={(next) => {
          setPreviewOpen(next);
          if (!next) {
            setPreviewFile(null);
            setPreviewUrl(null);
            setPreviewError(null);
          }
        }}
        file={previewFile}
        url={previewUrl}
        loading={previewLoading}
        error={previewError}
        onDownload={() => previewFile && void downloadFile(previewFile)}
        downloading={Boolean(previewFile) && downloadingKey === previewFile?.key}
      />
    </div>
  );
}

export default function BucketBrowserPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <BucketBrowserContent />
    </Suspense>
  );
}
