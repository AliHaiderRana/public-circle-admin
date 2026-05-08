'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const EmailBuilder = dynamic(
  () =>
    import('@alihaiderrana/email-builder-sdk').then((mod) => mod.EmailBuilder),
  { ssr: false }
);

type BuilderInstance = {
  editor: {
    exportHtml: (cb: (payload: { html: string }) => void) => void;
  };
};

type AdminEmailTemplateEditorProps = {
  initialHtml: string;
  onChange?: (html: string) => void;
  uploadImage?: (file: File, done: (result: { progress: number; url: string }) => void) => void;
  listAssets?: (params?: { limit?: number }) => Promise<Array<{
    id?: string;
    name?: string;
    url: string;
    thumbnailUrl?: string;
  }>>;
  deleteAsset?: (payload: { id?: string; url?: string }) => Promise<boolean>;
  className?: string;
  withFrame?: boolean;
  preview?: boolean;
  previewOnly?: boolean;
  enabled?: boolean;
  showFooter?: boolean;
  includeUnsubscribe?: boolean;
  externalFooterHtml?: string;
  footerInjectionMode?: 'default' | 'sdk';
};

const LOCAL_DEV_EMAIL_BUILDER_URL = 'https://qa-pc-template-builder.netlify.app/';

export default function AdminEmailTemplateEditor({
  initialHtml,
  onChange,
  uploadImage,
  listAssets,
  deleteAsset,
  className,
  withFrame = true,
  preview = false,
  previewOnly = false,
  enabled = true,
  showFooter = false,
  includeUnsubscribe = false,
  externalFooterHtml,
  footerInjectionMode,
}: AdminEmailTemplateEditorProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<BuilderInstance | null>(null);

  const embedToken =
    (process.env.NEXT_PUBLIC_EMAIL_BUILDER_EMBED_TOKEN || '').trim();

  const builderSrc =
    (process.env.NEXT_PUBLIC_EMAIL_BUILDER_URL || '').trim() ||
    LOCAL_DEV_EMAIL_BUILDER_URL;

  const isPreviewMode = preview || previewOnly;

  const resolvedBuilderSrc = useMemo(() => {
    if (!isPreviewMode) return builderSrc;
    const joiner = builderSrc.includes('?') ? '&' : '?';
    return `${builderSrc}${joiner}preview=true&previewOnly=true`;
  }, [builderSrc, isPreviewMode]);

  const normalizedHtml = useMemo(() => initialHtml || '', [initialHtml]);

  const notifyError = useCallback((message: string) => {
    const normalized = (message || '').toLowerCase();
    if (normalized.includes('missing embed token')) {
      setError(
        'Email builder embed token is missing. Set NEXT_PUBLIC_EMAIL_BUILDER_EMBED_TOKEN.'
      );
      return;
    }
    if (normalized.includes('invalid') || normalized.includes('expired')) {
      setError('Email builder authentication failed. Verify your embed token.');
      return;
    }
    setError(message || 'Editor failed to initialize.');
  }, []);

  const handleUpload = useCallback(
    async (file: File): Promise<string> => {
      if (!uploadImage) {
        throw new Error('Image upload handler is not configured.');
      }

      return await new Promise<string>((resolve, reject) => {
        uploadImage(file, (result) => {
          if (result?.url) {
            resolve(result.url);
            return;
          }
          reject(new Error('Upload did not return a URL.'));
        });
      });
    },
    [uploadImage]
  );

  if (!embedToken) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        Email builder embed token is missing. Set
        {' '}
        <strong>NEXT_PUBLIC_EMAIL_BUILDER_EMBED_TOKEN</strong>
        {' '}
        to enable template editing.
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className={`relative w-full h-full ${className || ''}`}>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Preview is disabled
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${withFrame ? 'rounded-xl border bg-card' : 'bg-transparent'} ${className || 'h-[70vh]'}`}
    >
      <EmailBuilder
        src={resolvedBuilderSrc}
        hideLoadingOverlay
        embedToken={embedToken}
        initialHtml={normalizedHtml}
        preview={isPreviewMode}
        previewOnly={isPreviewMode}
        config={isPreviewMode ? { preview: true, previewOnly: true } : undefined}
        showFooter={showFooter}
        includeUnsubscribe={includeUnsubscribe}
        externalFooterHtml={externalFooterHtml}
        footerInjectionMode={footerInjectionMode}
        onReady={() => setReady(true)}
        onChange={(html: string) => onChange?.(html)}
        onSave={(html: string) => onChange?.(html)}
        onUpload={handleUpload}
        onListAssets={listAssets}
        onDeleteAsset={deleteAsset}
        onAuthError={(message: string) => notifyError(message)}
        onStatusChange={(status: 'idle' | 'loading' | 'ready' | 'error') => {
          if (status === 'error' && !error) {
            notifyError('Email builder returned an error state.');
          }
        }}
        onInstanceReady={(instance: BuilderInstance) => {
          editorRef.current = instance;
        }}
        style={{ height: '100%', width: '100%' }}
      />

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
          {isPreviewMode ? 'Loading preview...' : 'Loading editor...'}
        </div>
      )}

      {error && (
        <div className="absolute left-4 right-4 top-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
