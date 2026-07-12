'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupportChatAttachment } from '@/lib/support-chat-attachment';
import type { SupportChatPendingUpload } from '@/lib/support-chat-pending';
import {
  getChatImageStableKey,
  isChatImageLoaded,
  markChatImageLoaded,
  shouldShowChatMessageText,
  formatMessageTime,
} from '@/lib/support-chat.util';
import { cn } from '@/lib/utils';
import { SupportChatImagePreview } from '@/components/SupportChatImagePreview';
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
  createdAt?: string;
  isConsecutivePrev?: boolean;
  isConsecutiveNext?: boolean;
  isInternal?: boolean;
};

const IMAGE_FRAME_CLASS = 'relative block w-full max-w-[220px] sm:max-w-[280px] max-h-[240px] sm:max-h-[320px] shrink-0 overflow-hidden';

const IMAGE_LOADING_SIZE_CLASS = 'h-36 w-48';

const IMAGE_CLASS = 'block w-full h-full object-cover';

function attachmentHasImage(attachment?: SupportChatAttachment): boolean {
  if (!attachment) return false;
  if (attachment.viewUrl || attachment.s3Path) return true;
  return Boolean(
    attachment.contentType?.startsWith('image/') && attachment.originalName,
  );
}

function ImageLoadingSlot() {
  return (
    <div
      className={cn(
        IMAGE_FRAME_CLASS,
        IMAGE_LOADING_SIZE_CLASS,
        'flex items-center justify-center rounded-[16px] bg-muted',
      )}
      aria-label="Loading image"
    >
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function ImageErrorSlot({ message }: { message?: string }) {
  return (
    <div
      className={cn(
        IMAGE_FRAME_CLASS,
        IMAGE_LOADING_SIZE_CLASS,
        'flex flex-col items-center justify-center gap-1 px-2 text-center rounded-[16px] bg-muted text-muted-foreground',
      )}
    >
      <ImageOff className="size-4 shrink-0 opacity-70" />
      <span className="text-[10px] leading-tight">{message || "Couldn't load"}</span>
    </div>
  );
}

function getBubbleBorderRadiusClasses(
  tone: 'user' | 'support',
  isConsecutivePrev: boolean,
  isConsecutiveNext: boolean,
) {
  if (tone === 'support') {
    if (isConsecutivePrev && isConsecutiveNext) {
      return 'rounded-[16px] rounded-tr-[4px] rounded-br-[4px]';
    } else if (isConsecutivePrev) {
      return 'rounded-[16px] rounded-tr-[4px]';
    } else if (isConsecutiveNext) {
      return 'rounded-[16px] rounded-br-[4px]';
    }
    return 'rounded-[16px]';
  } else {
    if (isConsecutivePrev && isConsecutiveNext) {
      return 'rounded-[16px] rounded-tl-[4px] rounded-bl-[4px]';
    } else if (isConsecutivePrev) {
      return 'rounded-[16px] rounded-tl-[4px]';
    } else if (isConsecutiveNext) {
      return 'rounded-[16px] rounded-bl-[4px]';
    }
    return 'rounded-[16px]';
  }
}

function SupportChatMessageImage({
  src,
  previewSrc,
  stableKey,
  alt,
  imageClassName,
  pendingUpload,
  awaitingUrl,
  onReady,
}: {
  src?: string;
  previewSrc?: string;
  stableKey?: string;
  alt: string;
  imageClassName?: string;
  pendingUpload?: SupportChatPendingUpload;
  awaitingUrl?: boolean;
  onReady?: () => void;
}) {
  const isCached = stableKey ? isChatImageLoaded(stableKey) : false;
  const isPreviewCached = previewSrc ? isChatImageLoaded(previewSrc) : false;

  const [decoded, setDecoded] = useState(isCached);
  const [remoteLoaded, setRemoteLoaded] = useState(isCached);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState(false);
  const notifiedRef = useRef(isCached);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const imgRef = useRef<HTMLImageElement>(null);

  const showUploadOverlay = Boolean(
    pendingUpload && pendingUpload.progress < 100 && !pendingUpload.error,
  );

  useEffect(() => {
    if (!stableKey) return;

    const cached = isChatImageLoaded(stableKey);
    setRemoteLoaded(cached);

    if (cached) {
      setDecoded(true);
      setError(false);
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onReadyRef.current?.();
      }
      return;
    }

    // Keep the image visible if we already have dimensions (i.e. transitioning from blob)
    if (!dimensions) {
      setDecoded(false);
    }
    setError(false);
    notifiedRef.current = false;
  }, [stableKey, dimensions]);

  const notifyReady = () => {
    if (stableKey) markChatImageLoaded(stableKey);
    setDecoded(true);
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    onReadyRef.current?.();
  };

  const handleImageLoad = (naturalWidth: number, naturalHeight: number) => {
    if (naturalWidth < 1) {
      setError(true);
      return;
    }

    setDimensions({ width: naturalWidth, height: naturalHeight });

    if (src) {
      notifyReady();
    } else {
      if (previewSrc) markChatImageLoaded(previewSrc);
      setDecoded(true);
    }
  };

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleImageLoad(img.naturalWidth, img.naturalHeight);
    }
  }, [src, previewSrc]);

  if (pendingUpload?.error) {
    return <ImageErrorSlot message={pendingUpload.error} />;
  }

  // Display S3 remote URL if available, else fall back to local preview blob URL
  const displaySrc = src || previewSrc;

  if (!displaySrc) {
    if (awaitingUrl || showUploadOverlay) {
      return <ImageLoadingSlot />;
    }
    return null;
  }

  if (error) {
    return <ImageErrorSlot />;
  }

  const ready =
    (stableKey ? isChatImageLoaded(stableKey) : false) ||
    decoded ||
    (previewSrc ? isChatImageLoaded(previewSrc) : false) ||
    isPreviewCached;

  return (
    <div
      className={cn(
        IMAGE_FRAME_CLASS,
        !ready && IMAGE_LOADING_SIZE_CLASS,
        !ready && 'bg-muted/50',
      )}
      style={
        ready && dimensions
          ? {
              aspectRatio: `${dimensions.width} / ${dimensions.height}`,
            }
          : undefined
      }
    >
      <img
        ref={imgRef}
        src={displaySrc}
        alt={alt}
        decoding="async"
        onLoad={(event) => {
          handleImageLoad(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
        }}
        onError={() => setError(true)}
        className={cn(
          IMAGE_CLASS,
          imageClassName,
          'rounded-t-[inherit] rounded-b-[inherit] transition-opacity duration-200',
          ready ? 'opacity-100' : 'opacity-0',
        )}
      />

      {showUploadOverlay ? (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 bg-black/50 px-3 rounded-[inherit]">
          <Loader2 className="size-5 animate-spin text-white" />
          <span className="text-[10px] font-medium text-white tabular-nums">
            {pendingUpload?.progress ?? 0}%
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function SupportChatMessageContent({
  message,
  attachment,
  pendingUpload,
  className,
  imageClassName,
  imageTone = 'support',
  onMediaLoad,
  onRemoteImageReady,
  createdAt,
  isConsecutivePrev = false,
  isConsecutiveNext = false,
  isInternal = false,
}: SupportChatMessageContentProps) {
  const imageStableKey = getChatImageStableKey(
    attachment,
    pendingUpload?.previewUrl && !attachment?.viewUrl
      ? pendingUpload.previewUrl
      : undefined,
  );

  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const remoteUrl = attachment?.viewUrl;
  const localUrl = pendingUpload?.previewUrl;
  const imageSrc = remoteUrl || localUrl;
  const awaitingUrl = attachmentHasImage(attachment) && !imageSrc;
  const hasImage = Boolean(imageSrc || awaitingUrl);
  const showText = shouldShowChatMessageText(message, { hasImage });

  const isImageOrPreviewLoaded = () => {
    if (imageStableKey && isChatImageLoaded(imageStableKey)) return true;
    if (localUrl && isChatImageLoaded(localUrl)) return true;
    return false;
  };

  const [imageReady, setImageReady] = useState(isImageOrPreviewLoaded);
  const imageReadyNotifiedRef = useRef(isImageOrPreviewLoaded());

  useEffect(() => {
    if (isImageOrPreviewLoaded()) {
      setImageReady(true);
      return;
    }
    imageReadyNotifiedRef.current = false;
    setImageReady(false);
  }, [imageStableKey, localUrl]);

  if (!showText && !hasImage) {
    return null;
  }

  const handleImageReady = () => {
    setImageReady(true);
    if (imageReadyNotifiedRef.current) return;
    imageReadyNotifiedRef.current = true;
    onMediaLoad?.();
    if (remoteUrl) onRemoteImageReady?.();
  };

  if (!hasImage) {
    return (
      <p className={cn('whitespace-pre-wrap leading-relaxed', className)}>
        {(message || '').trim()}
      </p>
    );
  }

  const borderRadiusClass = getBubbleBorderRadiusClasses(
    imageTone,
    isConsecutivePrev,
    isConsecutiveNext,
  );

  // Note: For admin view, imageTone === 'support' is aligned right, tone === 'user' is aligned left.
  const isRightAligned = imageTone === 'support';

  if (!showText) {
    // Image-only message
    return (
      <div className={cn('flex flex-col', isRightAligned ? 'items-end' : 'items-start', className)}>
        <button
          type="button"
          onClick={() => imageReady && setFullscreenOpen(true)}
          disabled={!imageReady}
          className={cn(
            'flex w-fit max-w-full text-left focus:outline-none items-start justify-start overflow-hidden border',
            borderRadiusClass,
            isInternal ? 'border-dashed' : 'border-transparent',
            imageReady && 'focus-visible:ring-2 focus-visible:ring-primary',
            !imageReady && 'cursor-default',
          )}
          aria-label={imageReady ? 'View chat image' : 'Loading chat image'}
        >
          <SupportChatMessageImage
            src={imageSrc}
            previewSrc={localUrl}
            stableKey={imageStableKey}
            alt={attachment?.originalName || 'Chat image'}
            imageClassName={imageClassName}
            pendingUpload={pendingUpload}
            awaitingUrl={awaitingUrl}
            onReady={handleImageReady}
          />
        </button>

        {createdAt && (
          <p className={cn(
            'text-[10px] text-muted-foreground mt-1 px-1.5 tabular-nums flex items-center gap-1.5',
            isRightAligned ? 'justify-end text-right' : 'justify-start text-left'
          )}>
            {formatMessageTime(createdAt)}
            {isInternal && (
              <span className="font-normal text-muted-foreground">
                · Internal
              </span>
            )}
          </p>
        )}

        <SupportChatImagePreview
          src={imageReady && imageSrc ? imageSrc : null}
          alt={attachment?.originalName || 'Chat image'}
          open={fullscreenOpen}
          onOpenChange={setFullscreenOpen}
        />
      </div>
    );
  }

  // Image with Caption
  return (
    <div className={cn('flex flex-col', isRightAligned ? 'items-end' : 'items-start', className)}>
      <div
        className={cn(
          'w-fit max-w-[220px] sm:max-w-[280px] flex flex-col shadow-sm overflow-hidden border',
          borderRadiusClass,
          isRightAligned
            ? isInternal
              ? 'bg-muted/60 text-foreground border-dashed'
              : 'bg-muted text-foreground border-border/80'
            : 'bg-background text-foreground border-border/50',
        )}
      >
        <button
          type="button"
          onClick={() => imageReady && setFullscreenOpen(true)}
          disabled={!imageReady}
          className={cn(
            'flex w-full text-left focus:outline-none items-start justify-start overflow-hidden rounded-t-[inherit]',
            !imageReady && 'cursor-default',
          )}
          aria-label={imageReady ? 'View chat image' : 'Loading chat image'}
        >
          <SupportChatMessageImage
            src={imageSrc}
            previewSrc={localUrl}
            stableKey={imageStableKey}
            alt={attachment?.originalName || 'Chat image'}
            imageClassName={imageClassName}
            pendingUpload={pendingUpload}
            awaitingUrl={awaitingUrl}
            onReady={handleImageReady}
          />
        </button>

        <div className="flex flex-col px-3.5 pt-2.5 pb-2 text-left">
          <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
            {(message || '').trim()}
          </p>
          {createdAt && (
            <p
              className={cn(
                'text-[10px] mt-1 tabular-nums flex items-center gap-1.5',
                isRightAligned ? 'justify-end text-right' : 'justify-start text-left',
                'text-muted-foreground',
              )}
            >
              {formatMessageTime(createdAt)}
              {isInternal && (
                <span className="font-normal text-muted-foreground">
                  · Internal
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <SupportChatImagePreview
        src={imageReady && imageSrc ? imageSrc : null}
        alt={attachment?.originalName || 'Chat image'}
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
      />
    </div>
  );
}
