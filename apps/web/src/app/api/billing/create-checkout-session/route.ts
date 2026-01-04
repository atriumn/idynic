import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getApiUser } from "@/lib/supabase/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripe, getPriceIdForPlan } from "@/lib/billing/stripe";

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

  const { plan, successUrl, cancelUrl } = body;

  if (!plan || !["pro", "job_search"].includes(plan)) {
    return apiError(
      "validation_error",
      "Invalid plan. Must be 'pro' or 'job_search'",
      400,
    );
  }

  if (!successUrl || !cancelUrl) {
    return apiError(
      "validation_error",
      "successUrl and cancelUrl are required",
      400,
    );
  }

  const supabase = createServiceRoleClient();

  // Get or create Stripe customer
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  let customerId = subscription?.stripe_customer_id;

  if (!customerId) {
    // Get user email from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("id", user.id)
      .single();

    // Create Stripe customer
    try {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        name: profile?.name || undefined,
        metadata: {
          user_id: user.id,
        },
      });

      customerId = customer.id;
    } catch (err) {
      console.error("Failed to create Stripe customer:", err);
      const message =
        err instanceof Error ? err.message : "Failed to create customer";
      return apiError("stripe_error", message, 500);
    }

    // Update or create subscription record with customer ID
    await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        plan_type: "free",
        status: "active",
      },
      {
        onConflict: "user_id",
      },
    );
  }

  // Get the price ID for the selected plan
  let priceId: string;
  try {
    priceId = getPriceIdForPlan(plan);
  } catch (err) {
    console.error("Failed to get price ID:", err);
    return apiError(
      "configuration_error",
      `Price ID not configured for plan: ${plan}`,
      500,
    );
  }

  // Create Stripe Checkout session
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
      // Allow promotion codes
      allow_promotion_codes: true,
      // Collect billing address for tax purposes
      billing_address_collection: "auto",
    });

    return apiSuccess({
      sessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create checkout session";
    return apiError("stripe_error", message, 500);
  }
}
