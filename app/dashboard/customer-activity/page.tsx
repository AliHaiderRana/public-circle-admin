'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import UnifiedAdminActivityPanel from '@/components/UnifiedAdminActivityPanel';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

function CustomerActivityPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userEmail = (searchParams.get('userEmail') || '').trim();
  const userId = (searchParams.get('userId') || '').trim();

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin && !userEmail && !userId) {
      router.replace('/dashboard/users');
    }
  }, [authLoading, user, userEmail, userId, router]);

  if (authLoading || !user?.isSuperAdmin || (!userEmail && !userId)) {
    return (
      <div className="p-6 space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" className="gap-2 -ml-2" asChild>
        <Link href="/dashboard/users">
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>
      </Button>

      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-8 w-8 text-amber-600" />
          Login as user activity
        </h2>
        {userEmail && <p className="text-neutral-500 mt-1">{userEmail}</p>}
      </div>

      <UnifiedAdminActivityPanel
        initialUserEmail={userEmail}
        initialUserId={userId}
        defaultSource="public_circle"
        defaultLimit={25}
        title={userEmail ? `Public Circle activity — ${userEmail}` : 'Public Circle activity'}
        description="Actions in Public Circle while any admin used Login as user for this customer."
      />
    </div>
  );
}

export default function CustomerActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4 max-w-5xl">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <CustomerActivityPageContent />
    </Suspense>
  );
}
