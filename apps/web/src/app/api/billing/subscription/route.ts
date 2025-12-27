import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api/response";
import { PLAN_LIMITS, PlanType, PLAN_DISPLAY_NAMES } from "@/lib/billing/plan-limits";
import { getApiUser } from "@/lib/supabase/api-auth";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);

  if (!user) {
    return apiError("unauthorized", "Authentication required", 401);
  }

  const supabase = await createClient();

  // Get subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Get current usage
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  const periodStartStr = periodStart.toISOString().split("T")[0];

  const { data: usage } = await supabase
    .from("usage_tracking")
    .select("*")
    .eq("user_id", user.id)
    .eq("period_start", periodStartStr)
    .single();

  // Calculate period end (last day of month)
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setDate(0); // Last day of current month

  const planType = (subscription?.plan_type || "free") as PlanType;
  const limits = PLAN_LIMITS[planType];

  const uploadsCount = usage?.uploads_count ?? 0;
  const tailoredProfilesCount = usage?.tailored_profiles_count ?? 0;

  return apiSuccess({
    subscription: {
      plan_type: planType,
      plan_display_name: PLAN_DISPLAY_NAMES[planType],
      status: subscription?.status || "active",
      current_period_start: subscription?.current_period_start || periodStartStr,
      current_period_end: subscription?.current_period_end || periodEnd.toISOString(),
      cancel_at_period_end: subscription?.cancel_at_period_end || false,
    },
    usage: {
      uploads: uploadsCount,
      tailored_profiles: tailoredProfilesCount,
      period_start: periodStartStr,
      period_end: periodEnd.toISOString().split("T")[0],
    },
    limits: {
      uploads_per_month: limits.uploads_per_month === Infinity ? null : limits.uploads_per_month,
      tailored_profiles_per_month: limits.tailored_profiles_per_month === Infinity ? null : limits.tailored_profiles_per_month,
    },
    remaining: {
      uploads: limits.uploads_per_month === Infinity
        ? null
        : Math.max(0, limits.uploads_per_month - uploadsCount),
      tailored_profiles: limits.tailored_profiles_per_month === Infinity
        ? null
        : Math.max(0, limits.tailored_profiles_per_month - tailoredProfilesCount),
    },
    features: limits.features,
  });
}
