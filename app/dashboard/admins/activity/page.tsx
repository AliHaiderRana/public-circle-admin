'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AdminActivityGroupedPanel from '@/components/AdminActivityGroupedPanel';
import { ArrowLeft, ScrollText } from 'lucide-react';

function AdminActivityDetailPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const adminEmail = (searchParams.get('adminEmail') || '').trim();
  const adminName = (searchParams.get('adminName') || '').trim();

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
      <Button variant="ghost" size="sm" className="gap-2 -ml-2" asChild>
        <Link href="/dashboard/admins">
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Users
        </Link>
      </Button>

      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="h-8 w-8 text-amber-600" />
          Admin activity
        </h2>
        <p className="text-neutral-500 mt-1">{adminEmail}</p>
      </div>

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
