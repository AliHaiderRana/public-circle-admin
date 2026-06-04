'use client';

import AdminImpersonationActivitySection from '@/components/AdminImpersonationActivitySection';

export default function ImpersonationActivityPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customer session audit</h1>
        <p className="text-muted-foreground">
          Human-readable log of what admins did in Public Circle after using Login as user.
          Panel changes are in Panel audit log.
        </p>
      </div>
      <AdminImpersonationActivitySection
        title="All impersonation sessions"
        description="Most recent actions across all companies. Filter by company or user from their detail pages."
        defaultLimit={25}
      />
    </div>
  );
}
