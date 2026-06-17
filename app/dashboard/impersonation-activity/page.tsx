'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ImpersonationActivityRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    const userEmail = searchParams.get('userEmail');
    const userId = searchParams.get('userId');
    if (userEmail) params.set('userEmail', userEmail);
    if (userId) params.set('userId', userId);
    router.replace(`/dashboard/customer-activity?${params.toString()}`);
  }, [router, searchParams]);

  return null;
}

export default function ImpersonationActivityRedirectPage() {
  return (
    <Suspense fallback={null}>
      <ImpersonationActivityRedirect />
    </Suspense>
  );
}
