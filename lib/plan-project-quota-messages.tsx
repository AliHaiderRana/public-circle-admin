import type { ReactNode } from 'react';

export type ProjectQuotaChangeMessage = {
  title: string;
  body: ReactNode;
};

export function buildProjectQuotaChangeMessage({
  planName,
  currentLimit,
  newLimit,
}: {
  planName: string;
  currentLimit: number;
  newLimit: number;
}): ProjectQuotaChangeMessage | null {
  if (newLimit === currentLimit) return null;

  if (newLimit > currentLimit) {
    return {
      title: `Included projects: ${currentLimit} → ${newLimit}`,
      body: (
        <>
          This updates the included project limit for <strong>{planName}</strong>. Existing customer
          projects are not deleted. Companies can use the new included limit plus any paid add-ons
          they already have.
        </>
      ),
    };
  }

  return {
    title: `Included projects: ${currentLimit} → ${newLimit}`,
    body: (
      <>
        This lowers the included project limit for <strong>{planName}</strong>.{' '}
        <strong>No customer projects are deleted.</strong> Companies that already have more active
        projects than the new limit may need paid add-ons to create or restore projects until they
        archive projects or purchase slots.
      </>
    ),
  };
}
