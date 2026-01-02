/**
 * Onboarding prompts for guiding new users through their journey
 *
 * These prompts are shown after key milestones to help users discover
 * the next step in building their professional identity.
 */

export interface OnboardingAction {
  label: string;
  /** Route for navigation (null if action-based) */
  route?: string | null;
  /** Web-specific route override */
  webRoute?: string;
  /** Action identifier for in-context actions */
  action?: string;
}

export interface OnboardingPrompt {
  title: string;
  message: string;
  primaryAction: OnboardingAction;
  secondaryAction?: OnboardingAction;
}

export const ONBOARDING_PROMPTS = {
  after_resume_upload: {
    title: "Resume processed!",
    message:
      "We found claims about your skills and experience. Explore them now, or add an opportunity to see how you match.",
    primaryAction: {
      label: "Explore Claims",
      route: "/identity",
    },
    secondaryAction: {
      label: "Add Opportunity",
      route: "/add-opportunity",
      webRoute: "/opportunities",
    },
  },
  after_story_added: {
    title: "Story added!",
    message:
      "Your claims are getting stronger. Add more stories to boost confidence, or upload a resume for more evidence.",
    primaryAction: {
      label: "Add Another Story",
      route: null,
      action: "add_story",
    },
    secondaryAction: {
      label: "Upload Resume",
      route: null,
      action: "upload_resume",
    },
  },
  after_opportunity_added: {
    title: "Opportunity tracked!",
    message:
      "Generate a tailored profile to see how your experience aligns with this role.",
    primaryAction: {
      label: "Generate Profile",
      route: null,
      action: "generate_tailored_profile",
    },
  },
  after_profile_tailored: {
    title: "Profile ready!",
    message: "Share your tailored profile with a recruiter, or download as PDF.",
    primaryAction: {
      label: "Share Profile",
      action: "share_profile",
    },
    secondaryAction: {
      label: "Download PDF",
      action: "download_pdf",
    },
  },
} as const satisfies Record<string, OnboardingPrompt>;

export type OnboardingPromptKey = keyof typeof ONBOARDING_PROMPTS;

/**
 * Storage key used for persisting onboarding state
 */
export const ONBOARDING_STORAGE_KEY = "idynic_onboarding";
