/**
 * Claim evaluation orchestrator
 * Runs rule checks and AI grounding checks, then stores issues
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import {
  runRuleChecks,
  sampleClaimsForEval,
  type ClaimForEval,
  type ClaimIssue,
} from './rule-checks';
import { runClaimGroundingEval, type ClaimWithEvidence } from './claim-grounding';

export interface ClaimEvalResult {
  issuesFound: number;
  issuesStored: number;
  costCents: number;
}

/**
 * Run claim evaluation after document processing
 * - Fetches user's claims
 * - Runs rule-based checks (duplicates, missing fields)
 * - Samples claims for AI grounding check
 * - Stores issues in claim_issues table
 */
export async function runClaimEval(
  supabase: SupabaseClient<Database>,
  userId: string,
  documentId: string,
  options?: {
    maxClaimsForAiEval?: number;
  }
): Promise<ClaimEvalResult> {
  const maxClaimsForAiEval = options?.maxClaimsForAiEval ?? 5;

  // Fetch all claims for the user
  const { data: claims, error: claimsError } = await supabase
    .from('identity_claims')
    .select(`
      id,
      type,
      label,
      description,
      created_at,
      claim_evidence(count)
    `)
    .eq('user_id', userId);

  if (claimsError || !claims) {
    console.error('[run-claim-eval] Failed to fetch claims:', claimsError);
    return { issuesFound: 0, issuesStored: 0, costCents: 0 };
  }

  // Transform claims for eval
  const claimsForEval: ClaimForEval[] = claims.map(c => ({
    id: c.id,
    type: c.type,
    label: c.label,
    description: c.description,
    created_at: c.created_at,
    evidenceCount: (c.claim_evidence as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  // Run rule-based checks
  const ruleIssues = runRuleChecks(claimsForEval);

  // Sample claims for AI grounding check
  const sampledClaims = sampleClaimsForEval(claimsForEval, maxClaimsForAiEval);

  // Fetch evidence for sampled claims
  let aiIssues: ClaimIssue[] = [];
  let costCents = 0;

  if (sampledClaims.length > 0) {
    const sampledIds = sampledClaims.map(c => c.id);

    const { data: claimsWithEvidence } = await supabase
      .from('identity_claims')
      .select(`
        id,
        label,
        description,
        claim_evidence(
          evidence(text, strength)
        )
      `)
      .in('id', sampledIds);

    if (claimsWithEvidence && claimsWithEvidence.length > 0) {
      // Transform to ClaimWithEvidence format
      const claimsForGrounding: ClaimWithEvidence[] = claimsWithEvidence.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description,
        evidence: ((c.claim_evidence as unknown as Array<{ evidence: { text: string; strength: string } | null }>) || [])
          .filter((ce): ce is { evidence: { text: string; strength: string } } => ce?.evidence != null)
          .map(ce => ({
            text: ce.evidence.text,
            strength: ce.evidence.strength,
          })),
      }));

      // Run AI grounding check
      const groundingResult = await runClaimGroundingEval(claimsForGrounding, { userId });
      aiIssues = groundingResult.issues;
      costCents = groundingResult.costCents;
    }
  }

  // Combine all issues
  const allIssues = [...ruleIssues, ...aiIssues];

  if (allIssues.length === 0) {
    return { issuesFound: 0, issuesStored: 0, costCents };
  }

  // Store issues in claim_issues table
  const issuesToInsert = allIssues.map(issue => ({
    claim_id: issue.claimId,
    document_id: documentId,
    issue_type: issue.type,
    severity: issue.severity,
    message: issue.message,
    related_claim_id: issue.relatedClaimId || null,
  }));

  const { error: insertError } = await supabase
    .from('claim_issues')
    .insert(issuesToInsert);

  if (insertError) {
    console.error('[run-claim-eval] Failed to store issues:', insertError);
    return { issuesFound: allIssues.length, issuesStored: 0, costCents };
  }

  return {
    issuesFound: allIssues.length,
    issuesStored: allIssues.length,
    costCents,
  };
}
