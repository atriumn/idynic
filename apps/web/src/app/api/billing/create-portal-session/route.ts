import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getApiUser } from "@/lib/supabase/api-auth";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/billing/stripe";

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);

  if (!user) {
    return apiError("unauthorized", "Authentication required", 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_request", "Invalid JSON body", 400);
  }

  const { returnUrl } = body;

  if (!returnUrl) {
    return apiError("validation_error", "returnUrl is required", 400);
  }

  const supabase = await createClient();

  // Get the user's Stripe customer ID
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!subscription?.stripe_customer_id) {
    return apiError(
      "no_subscription",
      "No billing account found. Please subscribe to a plan first.",
      404
    );
  }

  // Create Stripe Billing Portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: returnUrl,
  });

  return apiSuccess({
    url: session.url,
  });
}
