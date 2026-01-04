import { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_LIMITS, PlanType } from "./plan-limits";

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number | "unlimited";
  planType: PlanType;
}

export interface UsageData {
  uploads_count: number;
  tailored_profiles_count: number;
  period_start: string;
}

/**
 * Get the user's current plan type from the subscriptions table
 */
export async function getUserPlanType(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanType> {
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_type, status")
    .eq("user_id", userId)
    .single();

  // Only count active or trialing subscriptions
  if (
    subscription &&
    (subscription.status === "active" || subscription.status === "trialing")
  ) {
    return subscription.plan_type as PlanType;
  }

  return "free";
}

/**
 * Get the user's current usage for this billing period
 */
export async function getCurrentUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageData> {
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  const periodStartStr = periodStart.toISOString().split("T")[0];

  const { data: usage } = await supabase
    .from("usage_tracking")
    .select("uploads_count, tailored_profiles_count, period_start")
    .eq("user_id", userId)
    .eq("period_start", periodStartStr)
    .single();

  return {
    uploads_count: usage?.uploads_count ?? 0,
    tailored_profiles_count: usage?.tailored_profiles_count ?? 0,
    period_start: periodStartStr,
  };
}

/**
 * Check if the user can upload another document
 */
export async function checkUploadLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageCheckResult> {
  const planType = await getUserPlanType(supabase, userId);
  const limit = PLAN_LIMITS[planType].uploads_per_month;

  if (limit === Infinity) {
    return {
      allowed: true,
      current: 0,
      limit: "unlimited",
      planType,
    };
  }

  const usage = await getCurrentUsage(supabase, userId);
  const current = usage.uploads_count;

  return {
    allowed: current < limit,
    reason:
      current >= limit
        ? `You've reached your upload limit of ${limit} document${limit === 1 ? "" : "s"} this month. Upgrade your plan for more uploads.`
        : undefined,
    current,
    limit,
    planType,
  };
}

/**
 * Check if the user can create another tailored profile
 */
export async function checkTailoredProfileLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageCheckResult> {
  const planType = await getUserPlanType(supabase, userId);
  const limit = PLAN_LIMITS[planType].tailored_profiles_per_month;

  if (limit === Infinity) {
    return {
      allowed: true,
      current: 0,
      limit: "unlimited",
      planType,
    };
  }

  const usage = await getCurrentUsage(supabase, userId);
  const current = usage.tailored_profiles_count;

  return {
    allowed: current < limit,
    reason:
      current >= limit
        ? `You've reached your tailored profile limit of ${limit} this month. Upgrade your plan for more.`
        : undefined,
    current,
    limit,
    planType,
  };
}

/**
 * Increment the upload count for the user
 */
export async function incrementUploadCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase.rpc("increment_upload_count", { p_user_id: userId });
}

/**
 * Increment the tailored profile count for the user
 */
export async function incrementTailoredProfileCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase.rpc("increment_tailored_profiles_count", {
    p_user_id: userId,
  });
}
