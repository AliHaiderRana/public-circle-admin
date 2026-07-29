'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SupportChatZoomableImage } from '@/components/SupportChatZoomableImage';

type SupportChatImagePreviewProps = {
  src: string | null;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SupportChatImagePreview({
  src,
  alt = 'Chat image',
  open,
  onOpenChange,
}: SupportChatImagePreviewProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[100] bg-black/95',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-8 outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onClick={() => onOpenChange(false)}
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Full-screen chat image preview with zoom. Press Escape or click outside to close.
          </DialogPrimitive.Description>

          <div className="absolute right-3 top-3 z-10 sm:right-5 sm:top-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                onOpenChange(false);
              }}
              className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
              aria-label="Close image preview"
            >
              <X className="size-5" />
            </Button>
          </div>

          {src && open ? (
            <div
              className="flex max-h-full w-full max-w-[min(100%,80rem)] flex-col items-center"
              onClick={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              <SupportChatZoomableImage src={src} alt={alt} />
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type SupportChatImageThumbnailProps = {
  src: string;
  alt?: string;
  onClick: () => void;
  className?: string;
};

export function SupportChatImageThumbnail({
  src,
  alt = 'Chat image',
  onClick,
  className,
}: SupportChatImageThumbnailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative mb-2 block max-w-full overflow-hidden rounded-lg text-left',
        'ring-1 ring-border/50 transition hover:ring-2 hover:ring-primary/35',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
      aria-label={`View full size: ${alt}`}
    >
      <img src={src} alt={alt} className="max-h-48 max-w-full bg-muted/30 object-contain" />
      <span
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center',
          'bg-black/0 transition group-hover:bg-black/25',
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-lg transition group-hover:opacity-100">
          <Maximize2 className="size-4" />
        </span>
      </span>
    </button>
  );
}
