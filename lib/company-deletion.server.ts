import Stripe from 'stripe';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import { runWithOptionalTransaction } from '@/lib/run-with-optional-transaction';
import {
  getCompanyDbFootprint,
  deleteCompanyDbFootprint,
  type CompanyDbFootprint,
} from '@/lib/db-analytics.server';
import {
  deleteCompanyObjects,
  peekCompanyAwsUsage,
  type CompanyUsageRow,
} from '@/lib/aws-analytics.server';
import { setProgress, clearProgress } from '@/lib/archive-progress.server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export type CompanyStripeSubscriptionItemRow = {
  /** Stripe Price id — needed to recreate this item on restore. */
  priceId: string | null;
  productName: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  quantity: number;
};

export type CompanyStripeSubscriptionRow = {
  id: string;
  status: Stripe.Subscription.Status;
  /** Every line item on the subscription — the plan itself plus any add-ons (e.g. Dedicated IP). */
  items: CompanyStripeSubscriptionItemRow[];
};

export type CompanyDeletionPreview = {
  company: { id: string; name: string; status: string };
  db: CompanyDbFootprint;
  aws: CompanyUsageRow | null;
  stripe: {
    customerId: string | null;
    subscriptions: CompanyStripeSubscriptionRow[];
  };
};

export async function listCancelableSubscriptions(
  customerId: string
): Promise<CompanyStripeSubscriptionRow[]> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
    expand: ['data.items.data.price'],
  });

  const cancelable = subs.data.filter(
    (s) => s.status !== 'canceled' && s.status !== 'incomplete_expired'
  );

  const productIds = [
    ...new Set(
      cancelable
        .flatMap((s) => s.items.data.map((item) => item.price?.product))
        .filter((p): p is string => typeof p === 'string')
    ),
  ];
  const products = await Promise.all(
    productIds.map((id) => stripe.products.retrieve(id).catch(() => null))
  );
  const productNameById = new Map(
    products
      .filter((p): p is Exclude<typeof p, null> => p !== null)
      .map((p) => [p.id, p.name])
  );

  return cancelable.map((s) => ({
    id: s.id,
    status: s.status,
    items: s.items.data.map((item) => {
      const productId = typeof item.price?.product === 'string' ? item.price.product : null;
      return {
        priceId: item.price?.id ?? null,
        productName: (productId && productNameById.get(productId)) || null,
        amount: item.price?.unit_amount ?? null,
        currency: item.price?.currency ?? null,
        interval: item.price?.recurring?.interval ?? null,
        quantity: item.quantity ?? 1,
      };
    }),
  }));
}

export async function cancelCompanySubscriptions(
  customerId: string
): Promise<{ cancelled: number; errors: string[] }> {
  const subs = await listCancelableSubscriptions(customerId);
  let cancelled = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    try {
      await stripe.subscriptions.cancel(sub.id);
      cancelled += 1;
    } catch (err) {
      errors.push(`${sub.id}: ${err instanceof Error ? err.message : 'Failed to cancel'}`);
    }
  }

  return { cancelled, errors };
}

export async function getCompanyDeletionPreview(companyId: string): Promise<CompanyDeletionPreview> {
  await dbConnect();

  const company = await Company.findById(companyId).lean<{
    _id: mongoose.Types.ObjectId;
    name: string;
    status: string;
    stripeCustomerId?: string;
  }>();
  if (!company) throw new Error('Company not found');

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection unavailable');

  const [dbFootprint, awsUsage, subscriptions] = await Promise.all([
    getCompanyDbFootprint(companyId),
    peekCompanyAwsUsage(db, companyId).catch(() => null),
    company.stripeCustomerId
      ? listCancelableSubscriptions(company.stripeCustomerId).catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    company: { id: companyId, name: company.name, status: company.status },
    db: dbFootprint,
    aws: awsUsage,
    stripe: { customerId: company.stripeCustomerId ?? null, subscriptions },
  };
}

export type CompanyDeletionResult = {
  companyName: string;
  stripe: { cancelled: number; errors: string[] };
  aws: { deletedObjects: number; deletedBytes: number; errors: string[] };
  db: { deletedDocuments: number; deletedCollections: string[] };
};

/**
 * Permanently deletes a company: cancels its Stripe subscriptions, deletes
 * its S3 objects, then deletes every MongoDB document that references it
 * (company document last). Irreversible — the caller must have already
 * re-authenticated the admin (password confirmation) before calling this.
 */
export async function performCompanyDeletion(companyId: string): Promise<CompanyDeletionResult> {
  await dbConnect();

  const company = await Company.findById(companyId).lean<{
    _id: mongoose.Types.ObjectId;
    name: string;
    stripeCustomerId?: string;
  }>();
  if (!company) throw new Error('Company not found');

  try {
    setProgress(companyId, 'delete', 'Stripe', 'Cancelling subscriptions…');
    const stripeResult = company.stripeCustomerId
      ? await cancelCompanySubscriptions(company.stripeCustomerId)
      : { cancelled: 0, errors: [] };

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection unavailable');
    setProgress(companyId, 'delete', 'Removing AWS files', 'Deleting S3 objects…');
    const awsResult = await deleteCompanyObjects(db, companyId).catch((err) => ({
      deletedObjects: 0,
      deletedBytes: 0,
      errors: [err instanceof Error ? err.message : 'Failed to delete S3 objects'],
    }));

    const dbResult = await runWithOptionalTransaction((session) =>
      deleteCompanyDbFootprint(companyId, session, (name, i, total) => {
        setProgress(
          companyId,
          'delete',
          'Removing database records',
          `Deleting ${name} (${i + 1} of ${total})…`,
          { current: i + 1, total }
        );
      })
    );

    return {
      companyName: company.name,
      stripe: stripeResult,
      aws: awsResult,
      db: dbResult,
    };
  } finally {
    clearProgress(companyId);
  }
}
