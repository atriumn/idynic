export const PLAN_LIMITS = {
  free: {
    uploads_per_month: 1,
    tailored_profiles_per_month: 5,
    features: {
      basic_identity_graph: true,
      shareable_links: true,
      pdf_export: false,
      view_tracking: false,
      priority_support: false,
    },
  },
  pro: {
    uploads_per_month: Infinity,
    tailored_profiles_per_month: 15,
    features: {
      basic_identity_graph: true,
      shareable_links: true,
      pdf_export: true,
      view_tracking: true,
      priority_support: true,
    },
  },
  job_search: {
    uploads_per_month: Infinity,
    tailored_profiles_per_month: Infinity,
    features: {
      basic_identity_graph: true,
      shareable_links: true,
      pdf_export: true,
      view_tracking: true,
      priority_support: true,
    },
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export const PLAN_DISPLAY_NAMES: Record<PlanType, string> = {
  free: "Free",
  pro: "Pro",
  job_search: "Job Search",
};

export const PLAN_PRICES: Record<
  Exclude<PlanType, "free">,
  { amount: number; interval: string; display: string }
> = {
  pro: {
    amount: 10000, // $100 in cents
    interval: "year",
    display: "$100/year",
  },
  job_search: {
    amount: 5000, // $50 in cents
    interval: "3 months",
    display: "$50 for 3 months",
  },
};

export function getPlanLimits(planType: PlanType) {
  return PLAN_LIMITS[planType];
}

export function canUpload(planType: PlanType, currentUploads: number): boolean {
  const limit = PLAN_LIMITS[planType].uploads_per_month;
  return limit === Infinity || currentUploads < limit;
}

export function canCreateTailoredProfile(
  planType: PlanType,
  currentProfiles: number,
): boolean {
  const limit = PLAN_LIMITS[planType].tailored_profiles_per_month;
  return limit === Infinity || currentProfiles < limit;
}

export function getRemainingUploads(
  planType: PlanType,
  currentUploads: number,
): number | "unlimited" {
  const limit = PLAN_LIMITS[planType].uploads_per_month;
  if (limit === Infinity) return "unlimited";
  return Math.max(0, limit - currentUploads);
}

export function getRemainingTailoredProfiles(
  planType: PlanType,
  currentProfiles: number,
): number | "unlimited" {
  const limit = PLAN_LIMITS[planType].tailored_profiles_per_month;
  if (limit === Infinity) return "unlimited";
  return Math.max(0, limit - currentProfiles);
}
