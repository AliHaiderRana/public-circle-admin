'use client';

import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/spinner';
import { isPartnerAllowedPath, PARTNER_HOME_PATH } from '@/lib/partner-routes.util';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PartnerRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user?.isPartner || !pathname) return;

    if (pathname === '/dashboard') {
      router.replace(PARTNER_HOME_PATH);
      return;
    }

    if (!isPartnerAllowedPath(pathname)) {
      router.replace(PARTNER_HOME_PATH);
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return null;
  }

  if (user?.isPartner && pathname && !isPartnerAllowedPath(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Spinner className="size-10" />
      </div>
    );
  }

  return <>{children}</>;
}
