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
export type SourceType = 'resume' | 'story' | 'certification' | 'inferred';

// Claim types from identity_claims table
export type ClaimType = 'skill' | 'achievement' | 'attribute' | 'education' | 'certification';

// Strength levels from claim_evidence junction
export type StrengthLevel = 'weak' | 'medium' | 'strong';

/**
 * Source weight multipliers
 * Higher = more trusted source
 */
export const SOURCE_WEIGHTS: Record<SourceType, number> = {
  certification: 1.5,  // Third-party verified
  resume: 1.0,         // Professional record (baseline)
  story: 0.8,          // Valuable but unverified
  inferred: 0.6,       // System-derived
};

/**
 * Half-life in years for recency decay by claim type
 * After one half-life, evidence contributes 50% of original weight
 * Infinity means no decay
 */
export const CLAIM_HALF_LIVES: Record<ClaimType, number> = {
  skill: 4,            // Tech skills evolve fast
  achievement: 7,      // Results matter longer
  attribute: 15,       // Character traits are durable
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
