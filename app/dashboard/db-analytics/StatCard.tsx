'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="mt-1 h-5 w-20" />
            ) : (
              <p className="truncate text-lg font-semibold tabular-nums leading-tight">
                {value}
              </p>
            )}
            {hint && !loading && (
              <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
