'use client';

import Link from 'next/link';
import { Inbox, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SupportCountBadge } from '@/components/SupportCountBadge';
import { useSupportStats } from '@/hooks/use-support-stats';
import { cn } from '@/lib/utils';

type SupportQuickLinksProps = {
  className?: string;
};

export function SupportQuickLinks({ className }: SupportQuickLinksProps) {
  const { stats } = useSupportStats();

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <Link href="/dashboard/support-requests" className="group block sm:col-span-2">
        <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
          <CardContent className="flex items-start gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Inbox className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">Support requests</p>
                <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
              </div>
              <p className="text-xs text-muted-foreground">
                Tickets, assignment, and live chat in one place
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {stats.unreadChatMessages > 0 && (
                  <>
                    <SupportCountBadge count={stats.unreadChatMessages} />
                    <span className="text-xs text-muted-foreground">
                      {stats.unreadChatMessages} unread
                    </span>
                  </>
                )}
                {stats.openSupportRequests > 0 && (
                  <>
                    <SupportCountBadge count={stats.openSupportRequests} variant="secondary" />
                    <span className="text-xs text-muted-foreground">
                      {stats.openSupportRequests} open
                    </span>
                  </>
                )}
                {stats.unreadChatMessages === 0 && stats.openSupportRequests === 0 && (
                  <span className="text-xs text-muted-foreground">All caught up</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
