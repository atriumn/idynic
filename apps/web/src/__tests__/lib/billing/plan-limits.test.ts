import { describe, it, expect } from "vitest";
import {
  PLAN_LIMITS,
  PLAN_DISPLAY_NAMES,
  PLAN_PRICES,
  getPlanLimits,
  canUpload,
  canCreateTailoredProfile,
  getRemainingUploads,
  getRemainingTailoredProfiles,
} from "@/lib/billing/plan-limits";

describe("PLAN_LIMITS constants", () => {
  it("should have free plan with restricted limits", () => {
    expect(PLAN_LIMITS.free.uploads_per_month).toBe(1);
    expect(PLAN_LIMITS.free.tailored_profiles_per_month).toBe(5);
    expect(PLAN_LIMITS.free.features.pdf_export).toBe(false);
    expect(PLAN_LIMITS.free.features.view_tracking).toBe(false);
  });

  it("should have pro plan with increased limits", () => {
    expect(PLAN_LIMITS.pro.uploads_per_month).toBe(Infinity);
    expect(PLAN_LIMITS.pro.tailored_profiles_per_month).toBe(15);
    expect(PLAN_LIMITS.pro.features.pdf_export).toBe(true);
    expect(PLAN_LIMITS.pro.features.view_tracking).toBe(true);
  });

  it("should have job_search plan with unlimited features", () => {
    expect(PLAN_LIMITS.job_search.uploads_per_month).toBe(Infinity);
    expect(PLAN_LIMITS.job_search.tailored_profiles_per_month).toBe(Infinity);
    expect(PLAN_LIMITS.job_search.features.priority_support).toBe(true);
  });
});

describe("PLAN_DISPLAY_NAMES", () => {
  it("should have display names for all plans", () => {
    expect(PLAN_DISPLAY_NAMES.free).toBe("Free");
    expect(PLAN_DISPLAY_NAMES.pro).toBe("Pro");
    expect(PLAN_DISPLAY_NAMES.job_search).toBe("Job Search");
  });
});

describe("PLAN_PRICES", () => {
  it("should have pricing for pro plan", () => {
    expect(PLAN_PRICES.pro.amount).toBe(10000);
    expect(PLAN_PRICES.pro.interval).toBe("year");
    expect(PLAN_PRICES.pro.display).toBe("$100/year");
  });

  it("should have pricing for job_search plan", () => {
    expect(PLAN_PRICES.job_search.amount).toBe(5000);
    expect(PLAN_PRICES.job_search.interval).toBe("3 months");
    expect(PLAN_PRICES.job_search.display).toBe("$50 for 3 months");
  });
});

describe("getPlanLimits", () => {
  it("should return limits for free plan", () => {
    const limits = getPlanLimits("free");
    expect(limits).toBe(PLAN_LIMITS.free);
    expect(limits.uploads_per_month).toBe(1);
  });

  it("should return limits for pro plan", () => {
    const limits = getPlanLimits("pro");
    expect(limits).toBe(PLAN_LIMITS.pro);
    expect(limits.uploads_per_month).toBe(Infinity);
  });

  it("should return limits for job_search plan", () => {
    const limits = getPlanLimits("job_search");
    expect(limits).toBe(PLAN_LIMITS.job_search);
    expect(limits.tailored_profiles_per_month).toBe(Infinity);
  });
});

describe("canUpload", () => {
  it("should return true when under limit for free plan", () => {
    expect(canUpload("free", 0)).toBe(true);
  });

  it("should return false when at limit for free plan", () => {
    expect(canUpload("free", 1)).toBe(false);
  });

  it("should return false when over limit for free plan", () => {
    expect(canUpload("free", 5)).toBe(false);
  });

  it("should always return true for pro plan (unlimited)", () => {
    expect(canUpload("pro", 0)).toBe(true);
    expect(canUpload("pro", 100)).toBe(true);
    expect(canUpload("pro", 1000)).toBe(true);
  });

  it("should always return true for job_search plan (unlimited)", () => {
    expect(canUpload("job_search", 0)).toBe(true);
    expect(canUpload("job_search", 999)).toBe(true);
  });
});

describe("canCreateTailoredProfile", () => {
  it("should return true when under limit for free plan", () => {
    expect(canCreateTailoredProfile("free", 0)).toBe(true);
    expect(canCreateTailoredProfile("free", 4)).toBe(true);
  });

  it("should return false when at limit for free plan", () => {
    expect(canCreateTailoredProfile("free", 5)).toBe(false);
  });

  it("should return true when under limit for pro plan", () => {
    expect(canCreateTailoredProfile("pro", 0)).toBe(true);
    expect(canCreateTailoredProfile("pro", 14)).toBe(true);
  });

  it("should return false when at limit for pro plan", () => {
    expect(canCreateTailoredProfile("pro", 15)).toBe(false);
  });

  it("should always return true for job_search plan (unlimited)", () => {
    expect(canCreateTailoredProfile("job_search", 0)).toBe(true);
    expect(canCreateTailoredProfile("job_search", 100)).toBe(true);
  });
});

describe("getRemainingUploads", () => {
  it("should return remaining count for free plan", () => {
    expect(getRemainingUploads("free", 0)).toBe(1);
    expect(getRemainingUploads("free", 1)).toBe(0);
  });

  it("should not go below 0", () => {
    expect(getRemainingUploads("free", 10)).toBe(0);
  });

  it('should return "unlimited" for pro plan', () => {
    expect(getRemainingUploads("pro", 0)).toBe("unlimited");
    expect(getRemainingUploads("pro", 100)).toBe("unlimited");
  });

  it('should return "unlimited" for job_search plan', () => {
    expect(getRemainingUploads("job_search", 0)).toBe("unlimited");
  });
});

describe("getRemainingTailoredProfiles", () => {
  it("should return remaining count for free plan", () => {
    expect(getRemainingTailoredProfiles("free", 0)).toBe(5);
    expect(getRemainingTailoredProfiles("free", 3)).toBe(2);
    expect(getRemainingTailoredProfiles("free", 5)).toBe(0);
  });

  it("should return remaining count for pro plan", () => {
    expect(getRemainingTailoredProfiles("pro", 0)).toBe(15);
    expect(getRemainingTailoredProfiles("pro", 10)).toBe(5);
  });

  it("should not go below 0", () => {
    expect(getRemainingTailoredProfiles("free", 100)).toBe(0);
  });

  it('should return "unlimited" for job_search plan', () => {
    expect(getRemainingTailoredProfiles("job_search", 0)).toBe("unlimited");
    expect(getRemainingTailoredProfiles("job_search", 100)).toBe("unlimited");
  });
});
