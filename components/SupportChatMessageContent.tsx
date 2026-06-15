'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupportChatAttachment } from '@/lib/support-chat-attachment';
import type { SupportChatPendingUpload } from '@/lib/support-chat-pending';
import {
  getChatImageStableKey,
  isChatImageLoaded,
  markChatImageLoaded,
  shouldShowChatMessageText,
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
};

const IMAGE_FRAME_CLASS = 'relative inline-block max-w-full shrink-0 overflow-hidden rounded-lg';

/** Fixed footprint only while waiting — expands to image once decoded. */
const IMAGE_LOADING_SIZE_CLASS = 'h-36 w-48';

const IMAGE_CLASS = 'block h-auto w-auto max-h-48 max-w-full object-contain';

function attachmentHasImage(attachment?: SupportChatAttachment): boolean {
  if (!attachment) return false;
  if (attachment.viewUrl || attachment.s3Path) return true;
  return Boolean(
    attachment.contentType?.startsWith('image/') && attachment.originalName,
  );
}

function ImageLoadingSlot({ tone }: { tone: 'user' | 'support' }) {
  return (
    <div
      className={cn(
        IMAGE_FRAME_CLASS,
        IMAGE_LOADING_SIZE_CLASS,
        'flex items-center justify-center',
        tone === 'user' ? 'bg-black/10' : 'bg-black/[0.05] dark:bg-white/[0.06]',
      )}
      aria-label="Loading image"
    >
      <Loader2
        className={cn(
          'size-5 animate-spin',
          tone === 'user' ? 'text-white/50' : 'text-muted-foreground/60',
        )}
      />
    </div>
  );
}

function ImageErrorSlot({
  tone,
  message,
}: {
  tone: 'user' | 'support';
  message?: string;
}) {
  return (
    <div
      className={cn(
        IMAGE_FRAME_CLASS,
        IMAGE_LOADING_SIZE_CLASS,
        'flex flex-col items-center justify-center gap-1 px-2 text-center',
        tone === 'user'
          ? 'bg-black/15 text-white/70'
          : 'bg-muted/80 text-muted-foreground',
      )}
    >
      <ImageOff className="size-4 shrink-0 opacity-70" />
      <span className="text-[10px] leading-tight">{message || "Couldn't load"}</span>
    </div>
  );
}

function SupportChatMessageImage({
  src,
  stableKey,
  alt,
  imageClassName,
  imageTone,
  pendingUpload,
  awaitingUrl,
  onReady,
}: {
  src?: string;
  stableKey?: string;
  alt: string;
  imageClassName?: string;
  imageTone: 'user' | 'support';
  pendingUpload?: SupportChatPendingUpload;
  awaitingUrl?: boolean;
  onReady?: () => void;
}) {
  const [decoded, setDecoded] = useState(() => isChatImageLoaded(stableKey));
  const [error, setError] = useState(false);
  const notifiedRef = useRef(isChatImageLoaded(stableKey));
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const showUploadOverlay = Boolean(
    pendingUpload && pendingUpload.progress < 100 && !pendingUpload.error,
  );

  const ready = isChatImageLoaded(stableKey) || decoded;

  useEffect(() => {
    if (!stableKey) return;

    if (isChatImageLoaded(stableKey)) {
      setDecoded(true);
      setError(false);
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onReadyRef.current?.();
      }
      return;
    }

    setDecoded(false);
    setError(false);
    notifiedRef.current = false;
  }, [stableKey]);

  const notifyReady = () => {
    if (stableKey) markChatImageLoaded(stableKey);
    setDecoded(true);
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    onReadyRef.current?.();
  };

  if (pendingUpload?.error) {
    return <ImageErrorSlot tone={imageTone} message={pendingUpload.error} />;
  }

  if (!src) {
    if (awaitingUrl || showUploadOverlay) {
      return <ImageLoadingSlot tone={imageTone} />;
    }
    return null;
  }

  if (error) {
    return <ImageErrorSlot tone={imageTone} />;
  }

  return (
    <div
      className={cn(
        IMAGE_FRAME_CLASS,
        !ready && IMAGE_LOADING_SIZE_CLASS,
        !ready && 'bg-black/[0.03] dark:bg-white/[0.04]',
      )}
    >
      <img
        src={src}
        alt={alt}
        decoding="async"
        loading="lazy"
        onLoad={(event) => {
          if (event.currentTarget.naturalWidth < 1) {
            setError(true);
            return;
          }
          notifyReady();
        }}
        onError={() => setError(true)}
        className={cn(IMAGE_CLASS, imageClassName, 'rounded-lg')}
      />

      {showUploadOverlay ? (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 bg-black/50 px-3">
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
}: SupportChatMessageContentProps) {
  const imageStableKey = getChatImageStableKey(
    attachment,
    pendingUpload?.previewUrl && !attachment?.viewUrl
      ? pendingUpload.previewUrl
      : undefined,
  );

  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [imageReady, setImageReady] = useState(() => isChatImageLoaded(imageStableKey));
  const imageReadyNotifiedRef = useRef(isChatImageLoaded(imageStableKey));

  const remoteUrl = attachment?.viewUrl;
  const localUrl =
    pendingUpload?.previewUrl && !remoteUrl ? pendingUpload.previewUrl : undefined;
  const imageSrc = remoteUrl || localUrl;
  const awaitingUrl = attachmentHasImage(attachment) && !imageSrc;
  const hasImage = Boolean(imageSrc || awaitingUrl);
  const showText = shouldShowChatMessageText(message, { hasImage });

  useEffect(() => {
    if (imageStableKey && isChatImageLoaded(imageStableKey)) {
      setImageReady(true);
      return;
    }
    imageReadyNotifiedRef.current = false;
    setImageReady(false);
  }, [imageStableKey]);

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

  return (
    <div className={cn(showText && hasImage ? 'space-y-2' : '', className)}>
      {hasImage ? (
        <>
          <button
            type="button"
            onClick={() => imageReady && setFullscreenOpen(true)}
            disabled={!imageReady}
            className={cn(
              'inline-block max-w-full rounded-lg text-left focus:outline-none',
              imageReady &&
                'ring-1 ring-border/40 transition hover:ring-2 hover:ring-primary/30 focus-visible:ring-2 focus-visible:ring-primary',
              !imageReady && 'cursor-default',
            )}
            aria-label={imageReady ? 'View chat image' : 'Loading chat image'}
          >
            <SupportChatMessageImage
              src={imageSrc}
              stableKey={imageStableKey}
              alt={attachment?.originalName || 'Chat image'}
              imageClassName={imageClassName}
              imageTone={imageTone}
              pendingUpload={pendingUpload}
              awaitingUrl={awaitingUrl}
              onReady={handleImageReady}
            />
          </button>
          <SupportChatImagePreview
            src={imageReady && imageSrc ? imageSrc : null}
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
