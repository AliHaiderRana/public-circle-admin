'use client';

import { useRef } from 'react';
import {
  TransformWrapper,
  TransformComponent,
  useControls,
  useTransformEffect,
} from 'react-zoom-pan-pinch';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

type SupportChatZoomableImageProps = {
  src: string;
  alt: string;
  className?: string;
};

function ZoomToolbar({ scaleLabelRef }: { scaleLabelRef: React.RefObject<HTMLSpanElement | null> }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  useTransformEffect(({ state }) => {
    if (scaleLabelRef.current) {
      scaleLabelRef.current.textContent = `${Math.round(state.scale * 100)}%`;
    }
  });

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-2 text-white shadow-lg">
      <button
        type="button"
        onClick={() => zoomOut(0.35, 120)}
        className="inline-flex size-8 items-center justify-center rounded-full hover:bg-white/15"
        aria-label="Zoom out"
      >
        <Minus className="size-4" />
      </button>
      <span
        ref={scaleLabelRef}
        className="min-w-[3.5rem] text-center text-xs font-medium tabular-nums"
      >
        100%
      </span>
      <button
        type="button"
        onClick={() => zoomIn(0.35, 120)}
        className="inline-flex size-8 items-center justify-center rounded-full hover:bg-white/15"
        aria-label="Zoom in"
      >
        <Plus className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => resetTransform(150)}
        className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium hover:bg-white/15"
        aria-label="Reset zoom"
      >
        <RotateCcw className="size-3.5" />
        Fit
      </button>
    </div>
  );
}

export function SupportChatZoomableImage({ src, alt, className }: SupportChatZoomableImageProps) {
  const scaleLabelRef = useRef<HTMLSpanElement>(null);
  const showCaption = alt && alt !== 'Chat image';

  return (
    <div className={cn('flex w-full flex-col items-center gap-3', className)}>
      <TransformWrapper
        key={src}
        initialScale={1}
        minScale={0.5}
        maxScale={6}
        centerOnInit
        centerZoomedOut
        limitToBounds={false}
        smooth
        wheel={{ step: 0.08, smoothStep: 0.004 }}
        pinch={{ step: 4 }}
        panning={{ velocityDisabled: true }}
        doubleClick={{ mode: 'toggle', step: 0.65, animationTime: 150 }}
        zoomAnimation={{ animationTime: 150 }}
        alignmentAnimation={{ disabled: true }}
        velocityAnimation={{ disabled: true }}
      >
        <div className="h-[min(72dvh,calc(100dvh-11rem))] w-full overflow-hidden rounded-md">
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={src}
              alt={alt}
              decoding="async"
              draggable={false}
              className="max-h-[min(72dvh,calc(100dvh-11rem))] max-w-full select-none object-contain"
            />
          </TransformComponent>
        </div>
        <div className="mt-3 flex justify-center">
          <ZoomToolbar scaleLabelRef={scaleLabelRef} />
        </div>
      </TransformWrapper>

      {showCaption ? (
        <p className="max-w-lg truncate px-2 text-center text-xs text-white/70 sm:text-sm">{alt}</p>
      ) : null}
      <p className="text-center text-[10px] text-white/45">
        Scroll or pinch to zoom · drag to pan · double-click to toggle
      </p>
    </div>
  );
}
