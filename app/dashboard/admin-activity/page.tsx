'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import AdminActivityLogPanel from '@/components/AdminActivityLogPanel';
import { ScrollText } from 'lucide-react';

export default function AdminActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="h-8 w-8 text-amber-600" />
          Admin panel activity
        </h2>
        <p className="text-neutral-500 mt-1">
          Every important change made in this admin app — who did it, what changed, and when.
          Super admins only.
        </p>
      </div>

      <AdminActivityLogPanel
        defaultLimit={25}
        title="All activity"
        description="Filter by category or admin email. To see one person only, open Admin Users and click Activity on their row."
      />
    </div>
  );
}
