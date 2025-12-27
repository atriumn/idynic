"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlanType } from "@/lib/billing/plan-limits";

export interface SubscriptionData {
  subscription: {
    plan_type: PlanType;
    plan_display_name: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  };
  usage: {
    uploads: number;
    tailored_profiles: number;
    period_start: string;
    period_end: string;
  };
  limits: {
    uploads_per_month: number | null;
    tailored_profiles_per_month: number | null;
  };
  remaining: {
    uploads: number | null;
    tailored_profiles: number | null;
  };
  features: {
    basic_identity_graph: boolean;
    shareable_links: boolean;
    pdf_export: boolean;
    view_tracking: boolean;
    priority_support: boolean;
  };
}

async function fetchSubscription(): Promise<SubscriptionData> {
  const res = await fetch("/api/billing/subscription");
  if (!res.ok) {
    throw new Error("Failed to fetch subscription");
  }
  const json = await res.json();
  return json.data;
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: fetchSubscription,
    staleTime: 60 * 1000, // Cache for 1 minute
    retry: 1,
  });
}

interface CheckoutOptions {
  plan: "pro" | "job_search";
  successUrl: string;
  cancelUrl: string;
}

async function createCheckoutSession(options: CheckoutOptions): Promise<{ url: string }> {
  const res = await fetch("/api/billing/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || "Failed to create checkout session");
  }

  const json = await res.json();
  return json.data;
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

interface CreateSubscriptionOptions {
  plan: "pro" | "job_search";
}

interface CreateSubscriptionResult {
  subscriptionId: string;
  clientSecret: string;
}

async function createSubscription(options: CreateSubscriptionOptions): Promise<CreateSubscriptionResult> {
  const res = await fetch("/api/billing/create-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || "Failed to create subscription");
  }

  const json = await res.json();
  return json.data;
}

export function useCreateSubscription() {
  return useMutation({
    mutationFn: createSubscription,
  });
}

interface PortalOptions {
  returnUrl: string;
}

async function createPortalSession(options: PortalOptions): Promise<{ url: string }> {
  const res = await fetch("/api/billing/create-portal-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || "Failed to create portal session");
  }

  const json = await res.json();
  return json.data;
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: createPortalSession,
    onSuccess: (data) => {
      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useInvalidateSubscription() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["subscription"] });
}
