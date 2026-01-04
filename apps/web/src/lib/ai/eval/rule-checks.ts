/**
 * Rule-based claim checks (no AI cost)
 * - Duplicate detection via Jaro-Winkler similarity
 * - Required field validation
 */

export type IssueType =
  | "duplicate"
  | "missing_field"
  | "not_grounded"
  | "low_quality"
  | "unevaluated"
  | "other";
export type IssueSeverity = "error" | "warning";

export interface ClaimIssue {
  claimId: string;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  relatedClaimId?: string;
}

export interface ClaimForEval {
  id: string;
  type: string | null;
  label: string;
  description: string | null;
  created_at: string | null;
  evidenceCount?: number;
  embedding?: number[] | null;
}

const DUPLICATE_THRESHOLD = 0.92; // Higher threshold to reduce false positives
const SEMANTIC_DUPLICATE_THRESHOLD = 0.7; // Embedding cosine similarity - catches CI/CD variants

/**
 * Cosine similarity between two embedding vectors
 * Returns a value between -1 and 1, where 1 is identical
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Jaro-Winkler similarity algorithm
 * Returns a value between 0 and 1, where 1 is an exact match
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler modification: boost for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Check if two claims should be excluded from duplicate comparison
 * Returns true if they are semantically distinct despite high string similarity
 */
function shouldExcludeFromDuplicateCheck(
  label1: string,
  label2: string,
): boolean {
  // Pattern: "Founded X" / "Co-Founded X" - ventures are distinct by company name
  const founderPattern = /^(co-)?found(ed|er|ing)/i;
  if (founderPattern.test(label1) && founderPattern.test(label2)) {
    // Both are founder claims - only duplicate if company names match
    const company1 = label1.replace(founderPattern, "").trim();
    const company2 = label2.replace(founderPattern, "").trim();
    return company1.toLowerCase() !== company2.toLowerCase();
  }

  // Pattern: "AWS X" / "AWS Y" - AWS services are distinct
  const awsPattern = /^aws\s+/i;
  if (awsPattern.test(label1) && awsPattern.test(label2)) {
    // Only duplicate if the service name is the same
    const service1 = label1.replace(awsPattern, "").trim().toLowerCase();
    const service2 = label2.replace(awsPattern, "").trim().toLowerCase();
    return service1 !== service2;
  }

  // Pattern: Short labels (< 10 chars) - require exact match
  // "React" vs "React Native" should not be duplicates
  if (label1.length < 10 || label2.length < 10) {
    // For short labels, only consider duplicates if nearly identical
    return label1.toLowerCase() !== label2.toLowerCase();
  }

  return false;
}

/**
 * Check for duplicate claims based on label similarity AND semantic similarity
 * Uses type-awareness, string similarity, and embedding cosine similarity
 */
export function findDuplicates(claims: ClaimForEval[]): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < claims.length; i++) {
    if (processed.has(claims[i].id)) continue;

    for (let j = i + 1; j < claims.length; j++) {
      if (processed.has(claims[j].id)) continue;

      // Only compare claims of the same type
      if (claims[i].type !== claims[j].type) continue;

      const label1 = claims[i].label.toLowerCase().trim();
      const label2 = claims[j].label.toLowerCase().trim();

      // Skip if semantically distinct despite string similarity
      if (shouldExcludeFromDuplicateCheck(claims[i].label, claims[j].label)) {
        continue;
      }

      // Check string similarity first
      const stringSimilarity = jaroWinklerSimilarity(label1, label2);
      let isDuplicate = stringSimilarity >= DUPLICATE_THRESHOLD;

      // If not caught by string similarity, check semantic similarity via embeddings
      const embedding1 = claims[i].embedding;
      const embedding2 = claims[j].embedding;
      if (
        !isDuplicate &&
        embedding1 &&
        embedding2 &&
        Array.isArray(embedding1) &&
        Array.isArray(embedding2)
      ) {
        const semanticSimilarity = cosineSimilarity(embedding1, embedding2);
        isDuplicate = semanticSimilarity >= SEMANTIC_DUPLICATE_THRESHOLD;
      }

      if (isDuplicate) {
        // Determine which is the duplicate (newer one)
        const created1 = claims[i].created_at;
        const created2 = claims[j].created_at;
        const date1 = created1 ? new Date(created1) : new Date(0);
        const date2 = created2 ? new Date(created2) : new Date(0);

        const [duplicate, original] =
          date1 > date2 ? [claims[i], claims[j]] : [claims[j], claims[i]];

        issues.push({
          claimId: duplicate.id,
          type: "duplicate",
          severity: "warning",
          message: `Possible duplicate of "${original.label}"`,
          relatedClaimId: original.id,
        });

        processed.add(duplicate.id);
      }
    }
  }

  return issues;
}

/**
 * Check for missing required fields
 */
export function findMissingFields(claims: ClaimForEval[]): ClaimIssue[] {
  const issues: ClaimIssue[] = [];

  for (const claim of claims) {
    if (!claim.type) {
      issues.push({
        claimId: claim.id,
        type: "missing_field",
        severity: "error",
        message: "Claim is missing a type (skill, achievement, or attribute)",
      });
    }

    if (!claim.label || claim.label.trim().length === 0) {
      issues.push({
        claimId: claim.id,
        type: "missing_field",
        severity: "error",
        message: "Claim is missing a label",
      });
    }
  }

  return issues;
}

/**
 * Run all rule checks on claims
 */
export function runRuleChecks(claims: ClaimForEval[]): ClaimIssue[] {
  const duplicateIssues = findDuplicates(claims);
  const missingFieldIssues = findMissingFields(claims);

  return [...duplicateIssues, ...missingFieldIssues];
}

/**
 * Sample claims for AI grounding check
 * Prioritizes newer claims and claims with fewer evidence items
 */
export function sampleClaimsForEval(
  claims: ClaimForEval[],
  maxCount: number = 5,
): ClaimForEval[] {
  if (claims.length <= maxCount) {
    return claims;
  }

  // Sort by: fewer evidence first, then newer first
  const sorted = [...claims].sort((a, b) => {
    // Prioritize claims with less evidence (more likely to need checking)
    const evidenceDiff = (a.evidenceCount ?? 0) - (b.evidenceCount ?? 0);
    if (evidenceDiff !== 0) return evidenceDiff;

    // Then prioritize newer claims
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return sorted.slice(0, maxCount);
}
