'use client';

import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function HeaderWithInfo({ label, info }: { label: string; info: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="cursor-help" aria-label={`About ${label}`}>
            <Info className="h-3 w-3 text-muted-foreground/70" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs">
          {info}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
