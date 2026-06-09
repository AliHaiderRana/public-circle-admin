'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import AdminActivityGroupedPanel from '@/components/AdminActivityGroupedPanel';
import { ArrowLeft, Mail, ScrollText, User } from 'lucide-react';

function AdminActivityDetailPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const adminEmail = (searchParams.get('adminEmail') || '').trim();
  const adminName = (searchParams.get('adminName') || '').trim();
  const displayName = adminName || adminEmail;

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin && !adminEmail) {
      router.replace('/dashboard/admins');
    }
  }, [authLoading, user, adminEmail, router]);

  if (authLoading || !user?.isSuperAdmin || !adminEmail) {
    return (
      <div className="p-6 space-y-4 max-w-[1600px]">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px]">
      <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground" asChild>
        <Link href="/dashboard/admins">
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Users
        </Link>
      </Button>

      <Card className="border-amber-200/60 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/50 via-background to-background dark:from-amber-950/20">
        <CardContent className="pt-6 pb-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <User className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                <Badge variant="secondary" className="font-normal gap-1">
                  <ScrollText className="h-3 w-3" />
                  Activity audit
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {adminEmail}
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
                Full audit trail for this admin — panel changes and every Login as user session
                with actions grouped underneath.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AdminActivityGroupedPanel adminEmail={adminEmail} adminName={adminName} />
    </div>
  );
}

export default function AdminActivityDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4 max-w-[1600px]">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <AdminActivityDetailPageContent />
    </Suspense>
  );
}
