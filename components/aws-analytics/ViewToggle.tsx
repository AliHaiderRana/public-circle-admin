'use client';

import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AwsViewMode } from '@/hooks/use-aws-view-mode';

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: AwsViewMode;
  onChange: (mode: AwsViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(
          'h-7 w-7',
          mode === 'list' && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
        )}
        onClick={() => onChange('list')}
        aria-pressed={mode === 'list'}
        aria-label="List view"
      >
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(
          'h-7 w-7',
          mode === 'grid' && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
        )}
        onClick={() => onChange('grid')}
        aria-pressed={mode === 'grid'}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
