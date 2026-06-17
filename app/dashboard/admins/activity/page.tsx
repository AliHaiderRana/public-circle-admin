'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AdminActivityGroupedPanel from '@/components/AdminActivityGroupedPanel';
import { ArrowLeft, Mail, User } from 'lucide-react';

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
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" className="p-2 shrink-0" asChild>
          <Link href="/dashboard/admins" aria-label="Back to Admin Users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h2 className="text-3xl font-bold tracking-tight">View activity</h2>
          <p className="text-neutral-500 mt-1">
            Everything this admin did in the admin panel and in Public Circle after Login as user.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-tight">{displayName}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{adminEmail}</span>
            </p>
          </div>
          <Badge variant="secondary">Admin user</Badge>
        </CardContent>
      </Card>

      <Separator />

      <AdminActivityGroupedPanel adminEmail={adminEmail} adminName={adminName} />
    </div>
  );
}

export default function AdminActivityDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <AdminActivityDetailPageContent />
    </Suspense>
  );
}
