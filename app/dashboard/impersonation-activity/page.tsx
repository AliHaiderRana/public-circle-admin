'use client';

import AdminImpersonationActivitySection from '@/components/AdminImpersonationActivitySection';

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
      <AdminImpersonationActivitySection
        title="All sessions"
        description="Filter by admin email, date, and category. Newest first by default. Company and user pages offer narrower views."
        defaultLimit={25}
      />
    </div>
  );
}
