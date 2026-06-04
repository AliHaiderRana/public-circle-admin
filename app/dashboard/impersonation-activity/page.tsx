'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminImpersonationActivitySection from '@/components/AdminImpersonationActivitySection';

function ImpersonationActivityContent() {
  const searchParams = useSearchParams();
  const userEmail = (searchParams.get('userEmail') || '').trim();
  const userId = (searchParams.get('userId') || '').trim();

  const title = userEmail
    ? `Login as user activity — ${userEmail}`
    : 'All sessions';

  const description = userEmail
    ? 'Activity while any admin used Login as user for this customer. Clear the customer email filter to see all users.'
    : 'Filter by customer email, admin email, date, and category. Newest first by default.';

  return (
    <AdminImpersonationActivitySection
      title={title}
      description={description}
      defaultLimit={25}
      userId={userId || undefined}
      initialUserEmail={userEmail}
    />
  );
}

export default function ImpersonationActivityPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Login as user activity</h1>
        <p className="text-muted-foreground">
          Human-readable log of what admins did in Public Circle after using Login as user.
          Admin app changes are under Admin panel activity.
        </p>
      </div>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading activity filters…</p>
        }
      >
        <ImpersonationActivityContent />
      </Suspense>
    </div>
  );
}
