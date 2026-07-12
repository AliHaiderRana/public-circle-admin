'use client';

import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/spinner';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="size-12" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
