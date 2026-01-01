/**
 * Theme-aware color utilities for archetypes and claim types
 * Colors are defined as CSS variables in globals.css for light/dark mode support
 */

// Archetype styling - uses CSS variables that switch between light/dark
export const ARCHETYPE_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Builder: {
    bg: "var(--archetype-builder-bg)",
    text: "var(--archetype-builder-text)",
    border: "var(--archetype-builder-border)",
  },
  Optimizer: {
    bg: "var(--archetype-optimizer-bg)",
    text: "var(--archetype-optimizer-text)",
    border: "var(--archetype-optimizer-border)",
  },
  Connector: {
    bg: "var(--archetype-connector-bg)",
    text: "var(--archetype-connector-text)",
    border: "var(--archetype-connector-border)",
  },
  Guide: {
    bg: "var(--archetype-guide-bg)",
    text: "var(--archetype-guide-text)",
    border: "var(--archetype-guide-border)",
  },
  Stabilizer: {
    bg: "var(--archetype-stabilizer-bg)",
    text: "var(--archetype-stabilizer-text)",
    border: "var(--archetype-stabilizer-border)",
  },
  Specialist: {
    bg: "var(--archetype-specialist-bg)",
    text: "var(--archetype-specialist-text)",
    border: "var(--archetype-specialist-border)",
  },
  Strategist: {
    bg: "var(--archetype-strategist-bg)",
    text: "var(--archetype-strategist-text)",
    border: "var(--archetype-strategist-border)",
  },
  Advocate: {
    bg: "var(--archetype-advocate-bg)",
    text: "var(--archetype-advocate-text)",
    border: "var(--archetype-advocate-border)",
  },
  Investigator: {
    bg: "var(--archetype-investigator-bg)",
    text: "var(--archetype-investigator-text)",
    border: "var(--archetype-investigator-border)",
  },
  Performer: {
    bg: "var(--archetype-performer-bg)",
    text: "var(--archetype-performer-text)",
    border: "var(--archetype-performer-border)",
  },
};

const DEFAULT_ARCHETYPE_STYLE = {
  bg: "var(--archetype-stabilizer-bg)",
  text: "var(--archetype-stabilizer-text)",
  border: "var(--archetype-stabilizer-border)",
};

export function getArchetypeStyle(archetype: string | null | undefined) {
  if (!archetype) return DEFAULT_ARCHETYPE_STYLE;
  return ARCHETYPE_STYLES[archetype] || DEFAULT_ARCHETYPE_STYLE;
}

// Claim type styling - uses CSS variables that switch between light/dark
export const CLAIM_TYPE_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  skill: {
    bg: "var(--claim-skill-bg)",
    text: "var(--claim-skill-text)",
    border: "var(--claim-skill-border)",
  },
  achievement: {
    bg: "var(--claim-achievement-bg)",
    text: "var(--claim-achievement-text)",
    border: "var(--claim-achievement-border)",
  },
  attribute: {
    bg: "var(--claim-attribute-bg)",
    text: "var(--claim-attribute-text)",
    border: "var(--claim-attribute-border)",
  },
  education: {
    bg: "var(--claim-education-bg)",
    text: "var(--claim-education-text)",
    border: "var(--claim-education-border)",
  },
  certification: {
    bg: "var(--claim-certification-bg)",
    text: "var(--claim-certification-text)",
    border: "var(--claim-certification-border)",
  },
};

const DEFAULT_CLAIM_STYLE = {
  bg: "var(--muted)",
  text: "var(--muted-foreground)",
  border: "var(--border)",
};

export function getClaimTypeStyle(type: string | null | undefined) {
  if (!type) return DEFAULT_CLAIM_STYLE;
  return CLAIM_TYPE_STYLES[type] || DEFAULT_CLAIM_STYLE;
}

// Claim type labels (matching mobile)
export const CLAIM_TYPE_LABELS: Record<string, string> = {
  skill: "Skills",
  achievement: "Achievements",
  attribute: "Attributes",
  education: "Education",
  certification: "Certifications",
};
