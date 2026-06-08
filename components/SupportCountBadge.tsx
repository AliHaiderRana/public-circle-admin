import { cn } from '@/lib/utils';

type SupportCountBadgeProps = {
  count: number;
  className?: string;
  variant?: 'destructive' | 'secondary';
};

export function SupportCountBadge({
  count,
  className,
  variant = 'destructive',
}: SupportCountBadgeProps) {
  if (!count || count < 1) return null;

  const label = count > 99 ? '99+' : String(count);

  return (
    <span
      className={cn(
        'inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-none',
        variant === 'destructive'
          ? 'bg-destructive text-white'
          : 'bg-primary text-white',
        className,
      )}
      aria-label={`${count} items`}
    >
      {label}
    </span>
  );
}
