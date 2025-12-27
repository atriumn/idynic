import { NextRequest } from "next/server";
import type Stripe from "stripe";
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

  const { plan } = body;

  if (!plan || !["pro", "job_search"].includes(plan)) {
    return apiError("validation_error", "Invalid plan. Must be 'pro' or 'job_search'", 400);
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
      const message = err instanceof Error ? err.message : "Failed to create customer";
      return apiError("stripe_error", message, 500);
    }

    // Update or create subscription record with customer ID
    await supabase
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan_type: "free",
        status: "active",
      }, {
        onConflict: "user_id",
      });
  }

  // Get the price ID for the selected plan
  let priceId: string;
  try {
    priceId = getPriceIdForPlan(plan);
  } catch (err) {
    console.error("Failed to get price ID:", err);
    return apiError("configuration_error", `Price ID not configured for plan: ${plan}`, 500);
  }

  // Create incomplete subscription - payment will be collected via Elements
  try {
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        user_id: user.id,
      },
    });

    // Get the client secret from the payment intent
    // When using expand: ["latest_invoice.payment_intent"], we get the full objects
    const invoice = stripeSubscription.latest_invoice;
    console.log("Stripe invoice response:", JSON.stringify(invoice, null, 2));

    if (!invoice || typeof invoice === "string") {
      throw new Error("Failed to get invoice from subscription");
    }

    // Access payment_intent from the expanded invoice
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoiceObj = invoice as any;
    console.log("Invoice keys:", Object.keys(invoiceObj));
    console.log("payment_intent value:", invoiceObj.payment_intent);

    const paymentIntent = invoiceObj.payment_intent as Stripe.PaymentIntent | null;
    if (!paymentIntent) {
      throw new Error(`Failed to get payment intent from invoice. Invoice ID: ${invoiceObj.id}`);
    }

    return apiSuccess({
      subscriptionId: stripeSubscription.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("Stripe subscription error:", err);
    const message = err instanceof Error ? err.message : "Failed to create subscription";
    return apiError("stripe_error", message, 500);
  }
}
