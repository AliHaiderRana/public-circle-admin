'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { SupportChatAttachment } from '@/lib/support-chat-attachment';
import type { SupportChatPendingUpload } from '@/lib/support-chat-pending';
import { shouldShowChatMessageText } from '@/lib/support-chat.util';
import { cn } from '@/lib/utils';
import { SupportChatImagePreview } from '@/components/SupportChatImagePreview';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff, Loader2 } from 'lucide-react';

type SupportChatMessageContentProps = {
  message?: string;
  attachment?: SupportChatAttachment;
  pendingUpload?: SupportChatPendingUpload;
  className?: string;
  imageClassName?: string;
  imageTone?: 'user' | 'support';
  onMediaLoad?: () => void;
  onRemoteImageReady?: () => void;
};

const imageClass =
  'block max-h-48 max-w-full bg-transparent object-contain';

const IMAGE_FRAME_CLASS =
  'relative inline-block min-h-[9rem] min-w-[11rem] max-w-full overflow-hidden rounded-lg';

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      void (img.decode?.() ?? Promise.resolve())
        .then(() => resolve())
        .catch(() => resolve());
    };
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = url;
  });
}

function SupportChatImageSkeleton({
  tone,
  visible,
}: {
  tone: 'user' | 'support';
  visible: boolean;
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg transition-opacity duration-300',
        tone === 'user' ? 'bg-white/10' : 'bg-muted/80',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!visible}
    >
      <Skeleton
        className={cn(
          'absolute inset-0 rounded-lg',
          tone === 'user' ? 'bg-white/15' : 'bg-muted',
        )}
      />
      <Loader2
        className={cn(
          'relative z-[1] size-5 animate-spin',
          tone === 'user' ? 'text-white/70' : 'text-muted-foreground',
        )}
      />
      <span
        className={cn(
          'relative z-[1] text-[10px] font-medium',
          tone === 'user' ? 'text-white/60' : 'text-muted-foreground',
        )}
      >
        Loading image…
      </span>
    </div>
  );
}

const SupportChatMessageImage = memo(function SupportChatMessageImage({
  localUrl,
  remoteUrl,
  awaitingRemote = false,
  alt,
  imageClassName,
  imageTone,
  pendingUpload,
  onMediaLoad,
  onRemoteImageReady,
}: {
  localUrl?: string;
  remoteUrl?: string;
  awaitingRemote?: boolean;
  alt: string;
  imageClassName?: string;
  imageTone: 'user' | 'support';
  pendingUpload?: SupportChatPendingUpload;
  onMediaLoad?: () => void;
  onRemoteImageReady?: () => void;
}) {
  const [remoteVisible, setRemoteVisible] = useState(false);
  const [localSized, setLocalSized] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const notifiedRef = useRef(false);
  const revokedRef = useRef(false);

  const sizingUrl = localUrl || remoteUrl;
  const showUploadOverlay = Boolean(
    pendingUpload && pendingUpload.progress < 100 && !pendingUpload.error,
  );

  const contentReady =
    loadError ||
    Boolean(localUrl && localSized) ||
    Boolean(!localUrl && remoteUrl && remoteVisible);

  const showSkeleton = Boolean(
    (awaitingRemote || sizingUrl) && !contentReady && !showUploadOverlay && !loadError,
  );

  useEffect(() => {
    setLoadError(false);
    if (!remoteUrl) {
      setRemoteVisible(false);
      notifiedRef.current = false;
      return;
    }
    let cancelled = false;
    void preloadImage(remoteUrl)
      .then(() => {
        if (!cancelled) setRemoteVisible(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [remoteUrl]);

  useEffect(() => {
    if (!remoteVisible || notifiedRef.current) return;
    notifiedRef.current = true;
    const timer = window.setTimeout(() => onRemoteImageReady?.(), 320);
    return () => window.clearTimeout(timer);
  }, [remoteVisible, onRemoteImageReady]);

  useEffect(() => {
    if (!remoteVisible || !localUrl?.startsWith('blob:') || revokedRef.current) return;
    revokedRef.current = true;
    const timer = window.setTimeout(() => URL.revokeObjectURL(localUrl), 600);
    return () => window.clearTimeout(timer);
  }, [remoteVisible, localUrl]);

  if (!sizingUrl && !awaitingRemote) return null;

  return (
    <div className={IMAGE_FRAME_CLASS}>
      <SupportChatImageSkeleton tone={imageTone} visible={showSkeleton} />

      <div
        className={cn(
          'relative transition-opacity duration-300 ease-out',
          contentReady ? 'opacity-100' : 'opacity-0',
        )}
      >
        {localUrl ? (
          <img
            src={localUrl}
            alt={alt}
            onLoad={() => {
              setLocalSized(true);
              if (!remoteUrl) onMediaLoad?.();
            }}
            onError={() => setLoadError(true)}
            className={cn(
              imageClass,
              imageClassName,
              remoteVisible && remoteUrl && 'invisible',
            )}
          />
        ) : null}
        {remoteUrl ? (
          <img
            src={remoteUrl}
            alt={alt}
            onLoad={() => {
              if (remoteVisible) onMediaLoad?.();
            }}
            onError={() => setLoadError(true)}
            className={cn(
              imageClass,
              imageClassName,
              'transition-opacity duration-300 ease-out',
              localUrl
                ? cn(
                    'absolute left-0 top-0',
                    remoteVisible ? 'opacity-100' : 'opacity-0',
                  )
                : 'opacity-100',
            )}
          />
        ) : null}
      </div>

      <div
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 px-3 py-4',
          'transition-opacity duration-300 ease-out',
          showUploadOverlay ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!showUploadOverlay}
      >
        <Loader2 className="size-6 animate-spin text-white" />
        <div className="h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-150 ease-out"
            style={{
              width: `${Math.min(100, Math.max(pendingUpload?.progress ?? 0, 6))}%`,
            }}
          />
        </div>
        <span className="text-[10px] font-medium text-white tabular-nums">
          Uploading {pendingUpload?.progress ?? 0}%
        </span>
      </div>

      {pendingUpload?.error || loadError ? (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center',
            pendingUpload?.error
              ? 'bg-destructive/85 text-white'
              : imageTone === 'user'
                ? 'bg-black/40 text-white/80'
                : 'bg-muted text-muted-foreground',
          )}
        >
          <ImageOff className="size-5 shrink-0 opacity-80" />
          <span className="text-[11px] font-medium">
            {pendingUpload?.error || "Couldn't load image"}
          </span>
        </div>
      ) : null}
    </div>
  );
});

export function SupportChatMessageContent({
  message,
  attachment,
  pendingUpload,
  className,
  imageClassName,
  imageTone = 'support',
  onMediaLoad,
  onRemoteImageReady,
}: SupportChatMessageContentProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const localUrl = pendingUpload?.previewUrl;
  const remoteUrl = attachment?.viewUrl;
  const awaitingRemote = Boolean(attachment?.s3Path && !remoteUrl && !localUrl);
  const hasImage = Boolean(localUrl || remoteUrl || awaitingRemote);
  const showText = shouldShowChatMessageText(message, { hasImage });

  if (!showText && !hasImage) {
    return null;
  }

  return (
    <div className={cn(showText && hasImage ? 'space-y-2' : '', className)}>
      {hasImage ? (
        <>
          <button
            type="button"
            onClick={() => setFullscreenOpen(true)}
            disabled={!localUrl && !remoteUrl}
            className={cn(
              'group relative block max-w-full text-left',
              'ring-1 ring-border/50 transition hover:ring-2 hover:ring-primary/35',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'rounded-lg overflow-hidden disabled:pointer-events-none',
            )}
            aria-label="View chat image"
          >
            <SupportChatMessageImage
              localUrl={localUrl}
              remoteUrl={remoteUrl}
              awaitingRemote={awaitingRemote}
              alt={attachment?.originalName || 'Chat image'}
              imageClassName={imageClassName}
              imageTone={imageTone}
              pendingUpload={pendingUpload}
              onMediaLoad={onMediaLoad}
              onRemoteImageReady={onRemoteImageReady}
            />
          </button>
          <SupportChatImagePreview
            src={remoteUrl || localUrl || null}
            alt={attachment?.originalName || 'Chat image'}
            open={fullscreenOpen}
            onOpenChange={setFullscreenOpen}
          />
        </>
      ) : null}
      {showText ? (
        <p className="whitespace-pre-wrap leading-relaxed">{(message || '').trim()}</p>
      ) : null}
    </div>
  );
}
