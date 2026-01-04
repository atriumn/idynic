/**
 * Enhanced Confidence Scoring Module
 *
 * Implements recency decay and source weighting for identity claim confidence.
 *
 * Design decisions:
 * - Technical skills decay faster (4yr half-life) than leadership traits (15yr)
 * - Verified certifications weighted higher than self-reported stories
 * - Education/certifications don't decay (credentials are permanent)
 */

// Source types for evidence provenance
export type SourceType = "resume" | "story" | "certification" | "inferred";

// Claim types from identity_claims table
export type ClaimType =
  | "skill"
  | "achievement"
  | "attribute"
  | "education"
  | "certification";

// Strength levels from claim_evidence junction
export type StrengthLevel = "weak" | "medium" | "strong";

/**
 * Source weight multipliers
 * Higher = more trusted source
 */
export const SOURCE_WEIGHTS: Record<SourceType, number> = {
  certification: 1.5, // Third-party verified
  resume: 1.0, // Professional record (baseline)
  story: 0.8, // Valuable but unverified
  inferred: 0.6, // System-derived
};

/**
 * Half-life in years for recency decay by claim type
 * After one half-life, evidence contributes 50% of original weight
 * Infinity means no decay
 */
export const CLAIM_HALF_LIVES: Record<ClaimType, number> = {
  skill: 4, // Tech skills evolve fast
  achievement: 7, // Results matter longer
  attribute: 15, // Character traits are durable
  education: Infinity, // Degrees don't expire
  certification: Infinity, // Credentials are permanent (expiry handled separately)
};

/**
 * Strength multipliers (unchanged from existing system)
 */
export const STRENGTH_MULTIPLIERS: Record<StrengthLevel, number> = {
  strong: 1.2,
  medium: 1.0,
  weak: 0.7,
};

/**
 * Calculate recency decay factor for evidence
 *
 * Formula: 0.5 ^ (years_old / half_life)
 *
 * @param evidenceDate - When the evidence occurred
 * @param claimType - Type of claim (determines half-life)
 * @param referenceDate - Date to calculate age from (defaults to now)
 * @returns Decay factor between 0 and 1
 */
export function calculateRecencyDecay(
  evidenceDate: Date | null,
  claimType: ClaimType,
  referenceDate: Date = new Date(),
): number {
  // No date = no penalty (be generous)
  if (!evidenceDate) {
    return 1.0;
  }

  const halfLife = CLAIM_HALF_LIVES[claimType];

  // Infinite half-life = no decay
  if (halfLife === Infinity) {
    return 1.0;
  }

  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const ageInYears =
    (referenceDate.getTime() - evidenceDate.getTime()) / msPerYear;

  // Future dates or very recent = no decay
  if (ageInYears <= 0) {
    return 1.0;
  }

  // Exponential decay: 0.5 ^ (age / half_life)
  return Math.pow(0.5, ageInYears / halfLife);
}

/**
 * Get weight multiplier for evidence source type
 *
 * @param sourceType - Where the evidence came from
 * @returns Weight multiplier (higher = more trusted)
 */
export function getSourceWeight(sourceType: SourceType): number {
  return SOURCE_WEIGHTS[sourceType] ?? 1.0;
}

/**
 * Input for evidence weight calculation
 */
export interface EvidenceInput {
  strength: StrengthLevel;
  sourceType: SourceType;
  evidenceDate: Date | null;
  claimType: ClaimType;
}

/**
 * Calculate combined weight for a single evidence item
 *
 * Formula: strength_multiplier × recency_decay × source_weight
 *
 * @param evidence - Evidence item with metadata
 * @param referenceDate - Date to calculate recency from (defaults to now)
 * @returns Combined weight multiplier
 */
export function calculateEvidenceWeight(
  evidence: EvidenceInput,
  referenceDate: Date = new Date(),
): number {
  const strengthMultiplier = STRENGTH_MULTIPLIERS[evidence.strength];
  const recencyDecay = calculateRecencyDecay(
    evidence.evidenceDate,
    evidence.claimType,
    referenceDate,
  );
  const sourceWeight = getSourceWeight(evidence.sourceType);

  return strengthMultiplier * recencyDecay * sourceWeight;
}

/**
 * Base confidence levels by evidence count
 * (Preserved from existing system)
 */
const BASE_CONFIDENCE = {
  SINGLE: 0.5,
  DOUBLE: 0.7,
  TRIPLE: 0.8,
  MULTIPLE: 0.9,
};

const MAX_CONFIDENCE = 0.95;

/**
 * Calculate overall confidence score for a claim based on supporting evidence
 *
 * Formula: base_confidence(count) × avg(evidence_weights)
 * Capped at 0.95 maximum
 *
 * @param evidenceItems - Array of evidence with metadata
 * @param referenceDate - Date to calculate recency from (defaults to now)
 * @returns Confidence score between 0 and 0.95
 */
export function calculateClaimConfidence(
  evidenceItems: EvidenceInput[],
  referenceDate: Date = new Date(),
): number {
  if (evidenceItems.length === 0) {
    return 0;
  }

  // Calculate base confidence from evidence count
  let baseConfidence: number;
  switch (evidenceItems.length) {
    case 1:
      baseConfidence = BASE_CONFIDENCE.SINGLE;
      break;
    case 2:
      baseConfidence = BASE_CONFIDENCE.DOUBLE;
      break;
    case 3:
      baseConfidence = BASE_CONFIDENCE.TRIPLE;
      break;
    default:
      baseConfidence = BASE_CONFIDENCE.MULTIPLE;
  }

  // Calculate average weight across all evidence
  const totalWeight = evidenceItems.reduce(
    (sum, evidence) => sum + calculateEvidenceWeight(evidence, referenceDate),
    0,
  );
  const avgWeight = totalWeight / evidenceItems.length;

  // Apply weight to base confidence, cap at max
  const confidence = baseConfidence * avgWeight;
  return Math.min(confidence, MAX_CONFIDENCE);
}
