import { describe, it, expect } from "vitest";
import {
  ONBOARDING_PROMPTS,
  ONBOARDING_STORAGE_KEY,
  type OnboardingPromptKey,
} from "./onboarding";

describe("ONBOARDING_PROMPTS", () => {
  it("has all required milestone prompts", () => {
    expect(ONBOARDING_PROMPTS.after_resume_upload).toBeDefined();
    expect(ONBOARDING_PROMPTS.after_story_added).toBeDefined();
    expect(ONBOARDING_PROMPTS.after_opportunity_added).toBeDefined();
    expect(ONBOARDING_PROMPTS.after_profile_tailored).toBeDefined();
  });

  it("has exactly 4 milestones", () => {
    const keys = Object.keys(ONBOARDING_PROMPTS);
    expect(keys).toHaveLength(4);
  });

  describe("after_resume_upload prompt", () => {
    const prompt = ONBOARDING_PROMPTS.after_resume_upload;

    it("has required properties", () => {
      expect(prompt.title).toBe("Resume processed!");
      expect(prompt.message).toContain("claims");
      expect(prompt.primaryAction).toBeDefined();
      expect(prompt.secondaryAction).toBeDefined();
    });

    it("has correct primary action", () => {
      expect(prompt.primaryAction.label).toBe("Explore Claims");
      expect(prompt.primaryAction.route).toBe("/identity");
    });

    it("has correct secondary action with web override", () => {
      expect(prompt.secondaryAction?.label).toBe("Add Opportunity");
      expect(prompt.secondaryAction?.route).toBe("/add-opportunity");
      expect(prompt.secondaryAction?.webRoute).toBe("/opportunities");
    });
  });

  describe("after_story_added prompt", () => {
    const prompt = ONBOARDING_PROMPTS.after_story_added;

    it("has required properties", () => {
      expect(prompt.title).toBe("Story added!");
      expect(prompt.message).toContain("confidence");
      expect(prompt.primaryAction).toBeDefined();
      expect(prompt.secondaryAction).toBeDefined();
    });

    it("has correct actions", () => {
      expect(prompt.primaryAction.label).toBe("Add Another Story");
      expect(prompt.primaryAction.route).toBe("/add-story");
      expect(prompt.secondaryAction?.label).toBe("Upload Resume");
      expect(prompt.secondaryAction?.route).toBe("/upload-resume");
    });
  });

  describe("after_opportunity_added prompt", () => {
    const prompt = ONBOARDING_PROMPTS.after_opportunity_added;

    it("has required properties", () => {
      expect(prompt.title).toBe("Opportunity tracked!");
      expect(prompt.message).toContain("tailored profile");
      expect(prompt.primaryAction).toBeDefined();
    });

    it("has action-based primary action (no navigation)", () => {
      expect(prompt.primaryAction.label).toBe("Generate Profile");
      expect(prompt.primaryAction.route).toBeNull();
      expect(prompt.primaryAction.action).toBe("generate_tailored_profile");
    });

    it("has no secondary action", () => {
      expect("secondaryAction" in prompt).toBe(false);
    });
  });

  describe("after_profile_tailored prompt", () => {
    const prompt = ONBOARDING_PROMPTS.after_profile_tailored;

    it("has required properties", () => {
      expect(prompt.title).toBe("Profile ready!");
      expect(prompt.message).toContain("Share");
      expect(prompt.primaryAction).toBeDefined();
      expect(prompt.secondaryAction).toBeDefined();
    });

    it("has action-based actions", () => {
      expect(prompt.primaryAction.label).toBe("Share Profile");
      expect(prompt.primaryAction.action).toBe("share_profile");
      expect(prompt.secondaryAction?.label).toBe("Download PDF");
      expect(prompt.secondaryAction?.action).toBe("download_pdf");
    });
  });

  describe("all prompts", () => {
    it("have non-empty title and message", () => {
      Object.values(ONBOARDING_PROMPTS).forEach((prompt) => {
        expect(prompt.title.length).toBeGreaterThan(0);
        expect(prompt.message.length).toBeGreaterThan(0);
      });
    });

    it("have primaryAction with non-empty label", () => {
      Object.values(ONBOARDING_PROMPTS).forEach((prompt) => {
        expect(prompt.primaryAction.label.length).toBeGreaterThan(0);
      });
    });

    it("have either route or action defined for primary action", () => {
      Object.values(ONBOARDING_PROMPTS).forEach((prompt) => {
        const action = prompt.primaryAction;
        const hasRoute = "route" in action && action.route !== undefined;
        const hasAction = "action" in action && action.action !== undefined;
        expect(hasRoute || hasAction).toBe(true);
      });
    });
  });
});

describe("ONBOARDING_STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(typeof ONBOARDING_STORAGE_KEY).toBe("string");
    expect(ONBOARDING_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it("has expected value", () => {
    expect(ONBOARDING_STORAGE_KEY).toBe("idynic_onboarding");
  });
});

describe("OnboardingPromptKey type", () => {
  it("can be used to access prompts", () => {
    const keys: OnboardingPromptKey[] = [
      "after_resume_upload",
      "after_story_added",
      "after_opportunity_added",
      "after_profile_tailored",
    ];

    keys.forEach((key) => {
      expect(ONBOARDING_PROMPTS[key]).toBeDefined();
    });
  });
});
