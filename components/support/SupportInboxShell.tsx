'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SupportInboxShellProps = {
  sidebar: ReactNode;
  main: ReactNode;
  className?: string;
};

export function SupportInboxShell({ sidebar, main, className }: SupportInboxShellProps) {
  return (
    <div
      className={cn(
        'flex h-[calc(100vh-7rem)] min-h-[560px] overflow-hidden rounded-xl border bg-background shadow-sm',
        className,
      )}
    >
      <aside className="flex h-full min-h-0 w-full max-w-[380px] shrink-0 flex-col overflow-hidden border-r bg-muted/20">
        {sidebar}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col bg-background">{main}</section>
    </div>
  );
}
