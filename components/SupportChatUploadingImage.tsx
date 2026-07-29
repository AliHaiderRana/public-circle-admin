import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type SupportChatUploadingImageProps = {
  src: string;
  alt?: string;
  progress: number;
  error?: string;
  imageClassName?: string;
};

export function SupportChatUploadingImage({
  src,
  alt = 'Uploading image',
  progress,
  error,
  imageClassName,
}: SupportChatUploadingImageProps) {
  return (
    <div className="relative max-w-full overflow-hidden rounded-lg">
      <img
        src={src}
        alt={alt}
        className={cn('max-h-48 max-w-full bg-muted/30 object-contain', imageClassName)}
      />
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/85 px-2 text-center text-[11px] font-medium text-white">
          {error}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 px-3 py-4">
          <Loader2 className="size-6 animate-spin text-white" />
          <Progress
            value={Math.min(100, Math.max(progress, 6))}
            className="h-1.5 w-full max-w-[10rem]"
          />
          <span className="text-[10px] font-medium text-white tabular-nums">
            {progress < 100 ? `Uploading ${progress}%` : 'Sending…'}
          </span>
        </div>
      )}
    </div>
  );
}
