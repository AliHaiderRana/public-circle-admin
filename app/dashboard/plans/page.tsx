'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatByteUnit } from '@/lib/format-bytes';
import { buildProjectQuotaChangeMessage } from '@/lib/plan-project-quota-messages';

type PlanQuota = {
  project: number;
  email: number;
  bandwidth: number;
  contact: number;
};

type StripePlanPrice = {
  unitAmount: number;
  currency: string;
  priceId: string;
  productId: string;
};

type Plan = {
  _id: string;
  name: string;
  quota: PlanQuota;
  stripePrice: StripePlanPrice | null;
  updatedAt?: string;
};

function formatUsdPrice(unitAmount: number): string {
  return unitAmount.toFixed(2);
}

type DraftQuota = Record<string, PlanQuota>;

const quotaFields: Array<{
  key: keyof PlanQuota;
  label: string;
  hint?: string;
}> = [
  { key: 'email', label: 'Emails' },
  { key: 'bandwidth', label: 'Bandwidth (bytes)', hint: 'Stored in bytes; shown to customers with KB/MB units.' },
  { key: 'contact', label: 'Contacts' },
  { key: 'project', label: 'Projects' },
];

export default function PlanQuotasPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [draftByPlanId, setDraftByPlanId] = useState<DraftQuota>({});
  const [loading, setLoading] = useState(true);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmSavePlan, setConfirmSavePlan] = useState<Plan | null>(null);

  const loadPlans = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/plans', { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to fetch plans');
      }

      const nextPlans: Plan[] = Array.isArray(payload.plans) ? payload.plans : [];
      setPlans(nextPlans);
      setDraftByPlanId(
        Object.fromEntries(
          nextPlans.map((plan) => [
            plan._id,
            {
              project: Number(plan.quota?.project ?? 0),
              email: Number(plan.quota?.email ?? 0),
              bandwidth: Number(plan.quota?.bandwidth ?? 0),
              contact: Number(plan.quota?.contact ?? 0),
            },
          ]),
        ),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch plans';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const hasChanges = (plan: Plan) => {
    const draft = draftByPlanId[plan._id];
    if (!draft) return false;

    return (
      draft.project !== Number(plan.quota?.project ?? 0) ||
      draft.email !== Number(plan.quota?.email ?? 0) ||
      draft.bandwidth !== Number(plan.quota?.bandwidth ?? 0) ||
      draft.contact !== Number(plan.quota?.contact ?? 0)
    );
  };

  const changedPlanCount = useMemo(
    () => plans.filter((plan) => hasChanges(plan)).length,
    [plans, draftByPlanId],
  );

  const updateDraft = (planId: string, key: keyof PlanQuota, rawValue: string) => {
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      return;
    }

    setDraftByPlanId((prev) => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [key]: parsed,
      },
    }));
    setSuccessMessage('');
  };

  const resetDraft = (plan: Plan) => {
    setDraftByPlanId((prev) => ({
      ...prev,
      [plan._id]: {
        project: Number(plan.quota?.project ?? 0),
        email: Number(plan.quota?.email ?? 0),
        bandwidth: Number(plan.quota?.bandwidth ?? 0),
        contact: Number(plan.quota?.contact ?? 0),
      },
    }));
  };

  const projectQuotaChanged = (plan: Plan) => {
    const draft = draftByPlanId[plan._id];
    if (!draft) return false;
    return draft.project !== Number(plan.quota?.project ?? 0);
  };

  const performSave = async (plan: Plan) => {
    const draft = draftByPlanId[plan._id];
    if (!draft || !hasChanges(plan)) return;

    setSavingPlanId(plan._id);
    setErrorMessage('');
    setSuccessMessage('');

    const quotaPayload: Partial<PlanQuota> = {};
    if (draft.project !== Number(plan.quota?.project ?? 0)) quotaPayload.project = draft.project;
    if (draft.email !== Number(plan.quota?.email ?? 0)) quotaPayload.email = draft.email;
    if (draft.bandwidth !== Number(plan.quota?.bandwidth ?? 0)) quotaPayload.bandwidth = draft.bandwidth;
    if (draft.contact !== Number(plan.quota?.contact ?? 0)) quotaPayload.contact = draft.contact;

    try {
      const res = await fetch(`/api/plans/${plan._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quota: quotaPayload }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to update plan quota');
      }

      setSuccessMessage(`Updated quota for ${plan.name}.`);
      setConfirmSavePlan(null);
      await loadPlans();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update plan quota';
      setErrorMessage(message);
    } finally {
      setSavingPlanId(null);
    }
  };

  const handleSave = (plan: Plan) => {
    if (!hasChanges(plan)) return;
    if (projectQuotaChanged(plan)) {
      setConfirmSavePlan(plan);
      return;
    }
    void performSave(plan);
  };

  const confirmProjectMessage = useMemo(() => {
    if (!confirmSavePlan) return null;
    const draft = draftByPlanId[confirmSavePlan._id];
    if (!draft) return null;
    return buildProjectQuotaChangeMessage({
      planName: confirmSavePlan.name,
      currentLimit: Number(confirmSavePlan.quota?.project ?? 0),
      newLimit: draft.project,
    });
  }, [confirmSavePlan, draftByPlanId]);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Plan Quotas</h2>
        <p className="text-neutral-500">
          Edit subscription plan limits shown to customers (emails, bandwidth, contacts, projects).
          Prices shown in USD from Stripe (same as the customer app). Only quotas are editable here.
        </p>
      </div>

      {errorMessage ? (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="text-sm text-green-600" role="status">
          {successMessage}
        </p>
      ) : null}

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-neutral-500">No plans found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {plans.map((plan) => {
            const draft = draftByPlanId[plan._id];
            const dirty = hasChanges(plan);
            const isSaving = savingPlanId === plan._id;

            return (
              <Card key={plan._id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Layers className="h-5 w-5 text-primary" />
                        <CardTitle>{plan.name}</CardTitle>
                        <span className="text-sm font-normal text-neutral-500">
                          {plan.stripePrice ? (
                            <>
                              ${formatUsdPrice(plan.stripePrice.unitAmount)}{' '}
                              {plan.stripePrice.currency.toUpperCase()}/mo
                            </>
                          ) : (
                            'No USD price on Stripe'
                          )}
                        </span>
                      </div>
                      <CardDescription className="mt-1">
                        Changes apply to new quota checks and plan displays. Existing Stripe products
                        are unchanged.
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!dirty || isSaving}
                        onClick={() => resetDraft(plan)}
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!dirty || isSaving}
                        onClick={() => handleSave(plan)}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-1" />
                            Save quota
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {quotaFields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={`${plan._id}-${field.key}`}>{field.label}</Label>
                        <Input
                          id={`${plan._id}-${field.key}`}
                          type="number"
                          min={0}
                          step={1}
                          value={draft?.[field.key] ?? 0}
                          onChange={(event) =>
                            updateDraft(plan._id, field.key, event.target.value)
                          }
                        />
                        {field.key === 'bandwidth' ? (
                          <p className="text-xs text-neutral-500">
                            Customer display: {formatByteUnit(draft?.bandwidth ?? 0)}
                          </p>
                        ) : null}
                        {field.hint && field.key !== 'bandwidth' ? (
                          <p className="text-xs text-neutral-500">{field.hint}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {changedPlanCount > 0 && !loading ? (
        <p className="text-xs text-neutral-500">
          {changedPlanCount} plan{changedPlanCount === 1 ? '' : 's'} with unsaved changes.
        </p>
      ) : null}

      <AlertDialog
        open={Boolean(confirmSavePlan)}
        onOpenChange={(open) => {
          if (!open && !savingPlanId) setConfirmSavePlan(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmProjectMessage?.title ?? 'Confirm project quota change'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground leading-relaxed">
                {confirmProjectMessage?.body ?? 'Save the new included project limit for this plan?'}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(savingPlanId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(savingPlanId)}
              onClick={(event) => {
                event.preventDefault();
                if (confirmSavePlan) void performSave(confirmSavePlan);
              }}
            >
              {savingPlanId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Confirm and save'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
