'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, ExternalLink, File as FileIcon, Loader2 } from 'lucide-react';
import { formatBytes } from '@/app/dashboard/db-analytics/format';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']);
// Types the browser can render natively inside an iframe.
const IFRAME_EXTENSIONS = new Set(['pdf', 'json', 'txt', 'csv', 'log', 'md', 'html', 'htm', 'xml']);

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export type PreviewFile = {
  name: string;
  bytes: number;
};

export function FilePreviewDialog({
  open,
  onOpenChange,
  file,
  url,
  loading,
  error,
  onDownload,
  downloading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: PreviewFile | null;
  url: string | null;
  loading: boolean;
  error: string | null;
  onDownload: () => void;
  downloading: boolean;
}) {
  const ext = file ? fileExtension(file.name) : '';
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const isIframeable = IFRAME_EXTENSIONS.has(ext);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-medium">
                {file?.name ?? 'Preview'}
              </DialogTitle>
              {file && (
                <p className="text-xs text-muted-foreground">{formatBytes(file.bytes)}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {url && (
                <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5"
                onClick={onDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/20 p-4">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !url ? null : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file?.name ?? ''} className="max-h-full max-w-full object-contain" />
          ) : isIframeable ? (
            <iframe src={url} title={file?.name ?? 'Preview'} className="h-full w-full rounded border bg-background" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <FileIcon className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No inline preview available for this file type.
              </p>
              <Button type="button" size="sm" className="gap-1.5" onClick={onDownload} disabled={downloading}>
                <Download className="h-3.5 w-3.5" />
                Download instead
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
