import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return stripeInstance;
}

// For backwards compatibility - but prefer getStripe() for better error handling
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

// Price IDs from Stripe Dashboard - configure in env
export const STRIPE_PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID!,
  job_search: process.env.STRIPE_JOBSEARCH_PRICE_ID!,
} as const;

export function getPriceIdForPlan(plan: "pro" | "job_search"): string {
  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    throw new Error(`Price ID not configured for plan: ${plan}`);
  }
  return priceId;
}

export function getPlanFromPriceId(priceId: string): "pro" | "job_search" | null {
  if (priceId === STRIPE_PRICE_IDS.pro) return "pro";
  if (priceId === STRIPE_PRICE_IDS.job_search) return "job_search";
  return null;
}
