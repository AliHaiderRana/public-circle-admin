import { Badge } from '@/components/ui/badge';
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
    <Badge
      variant={variant === 'destructive' ? 'destructive' : 'default'}
      className={cn(
        'min-h-5 min-w-5 px-1.5 py-0 text-[10px] font-semibold tabular-nums leading-none',
        className,
      )}
      aria-label={`${count} items`}
    >
      {label}
    </Badge>
  );
}
