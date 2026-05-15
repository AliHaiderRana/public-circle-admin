import Stripe from 'stripe';

export type StripePlanPrice = {
  unitAmount: number;
  currency: string;
  priceId: string;
  productId: string;
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

/** Same USD selection as server `getPriceForRegion` for non-CAD regions. */
export function pickUsdSubscriptionPrice(
  prices: Stripe.ApiList<Stripe.Price>,
): Stripe.Price | null {
  const validPrices = prices.data.filter(
    (price) =>
      price.active &&
      price.currency === 'usd' &&
      price.unit_amount != null &&
      (!price.recurring || price.recurring.usage_type !== 'metered'),
  );

  if (validPrices.length > 0) {
    return validPrices[0];
  }

  const fallback = prices.data.find(
    (price) =>
      price.active &&
      price.unit_amount != null &&
      (!price.recurring || price.recurring.usage_type !== 'metered'),
  );

  return fallback ?? null;
}

/** Stripe product name → USD monthly price (unit_amount / 100, like public-circle). */
export async function fetchStripePlanPricesByName(): Promise<
  Record<string, StripePlanPrice>
> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {};
  }

  const { data: products } = await stripe.products.list({ limit: 100, active: true });

  const subscriptionProducts = products.filter(
    (product) =>
      product.name !== 'Top Up' &&
      product.metadata?.isAddOn !== 'true',
  );

  const priceLists = await Promise.all(
    subscriptionProducts.map((product) =>
      stripe.prices.list({ product: product.id, active: true, limit: 100 }),
    ),
  );

  const byName: Record<string, StripePlanPrice> = {};

  subscriptionProducts.forEach((product, index) => {
    const price = pickUsdSubscriptionPrice(priceLists[index]);
    if (!price?.unit_amount) return;

    byName[product.name] = {
      unitAmount: price.unit_amount / 100,
      currency: price.currency,
      priceId: price.id,
      productId: product.id,
    };
  });

  return byName;
}

/** Stripe product IDs linked to a Mongo plan (`metadata.planId` or product name). */
export async function getStripeProductIdsForPlan(
  planId: string,
  planName: string,
): Promise<string[]> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return [];
  }

  const { data: products } = await stripe.products.list({ limit: 100, active: true });

  return products
    .filter(
      (product) =>
        product.name !== 'Top Up' &&
        product.metadata?.isAddOn !== 'true' &&
        (product.metadata?.planId === planId || product.name === planName),
    )
    .map((product) => product.id);
}
