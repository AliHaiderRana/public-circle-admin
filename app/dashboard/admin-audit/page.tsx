'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminAuditRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const adminEmail = (searchParams.get('adminEmail') || '').trim();
    const params = new URLSearchParams();

    if (adminEmail) {
      params.set('adminEmail', adminEmail);
      const adminName = searchParams.get('adminName');
      if (adminName) params.set('adminName', adminName);
      router.replace(`/dashboard/admins/activity?${params.toString()}`);
      return;
    }

    const userEmail = searchParams.get('userEmail');
    const userId = searchParams.get('userId');
    const source = searchParams.get('source');
    if (userEmail) params.set('userEmail', userEmail);
    if (userId) params.set('userId', userId);
    if (source) params.set('source', source);

    if (userEmail || userId) {
      router.replace(`/dashboard/customer-activity?${params.toString()}`);
      return;
    }

    router.replace('/dashboard/admins');
  }, [router, searchParams]);

  return null;
}

export default function AdminAuditRedirectPage() {
  return (
    <Suspense fallback={null}>
      <AdminAuditRedirect />
    </Suspense>
  );
}
