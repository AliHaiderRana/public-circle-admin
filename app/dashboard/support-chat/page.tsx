'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SupportChatRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const company = searchParams.get('company');
    const ticket = searchParams.get('ticket');
    if (ticket) {
      router.replace(`/dashboard/support-requests?ticket=${ticket}`);
      return;
    }
    if (company) {
      router.replace(`/dashboard/support-requests?highlight=${company}`);
      return;
    }
    router.replace('/dashboard/support-requests');
  }, [router, searchParams]);

  return null;
}
