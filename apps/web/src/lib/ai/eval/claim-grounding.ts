/**
 * AI-based claim grounding evaluation
 * Uses Claude to verify claims are supported by their evidence
 */

import { aiComplete } from '../gateway';
import { getModelConfig } from '../config';
import type { ClaimIssue } from './rule-checks';

export interface ClaimWithEvidence {
  id: string;
  label: string;
  description: string | null;
  evidence: Array<{
    text: string;
    strength: string;
  }>;
}

interface GroundingEvaluation {
  claim_id: string;
  grounded: boolean;
  issue: string | null;
}

interface GroundingResponse {
  evaluations: GroundingEvaluation[];
}

const CLAIM_EVAL_PROMPT = `You are evaluating whether identity claims accurately represent their supporting evidence.

For each claim, determine if the claim's label and description are justified by the evidence provided.

Claims to evaluate:
{claims_json}

Each claim includes:
- label: the claim name (e.g., "React Development")
- description: what the user claims
- evidence: array of supporting evidence texts with their strength ratings

For each claim, respond:
- "grounded": true if evidence supports the claim
- "grounded": false if claim overstates, misrepresents, or isn't supported by evidence
- "issue": explanation if not grounded (null otherwise)

Be strict but fair:
- A claim is grounded if evidence reasonably supports it
- Flag claims that exaggerate (e.g., "expert" when evidence shows basic usage)
- Flag claims with no supporting evidence
- Don't flag claims just for being brief or general

Respond with JSON only:
{
  "evaluations": [
    { "claim_id": "uuid", "grounded": true, "issue": null },
    { "claim_id": "uuid", "grounded": false, "issue": "Claim says 'expert' but evidence only shows basic usage" }
  ]
}`;

/**
 * Run AI grounding check on claims
 * Returns issues for claims that are not grounded in evidence
 */
export async function runClaimGroundingEval(
  claims: ClaimWithEvidence[],
  options?: { userId?: string }
): Promise<{ issues: ClaimIssue[]; costCents: number }> {
  if (claims.length === 0) {
    return { issues: [], costCents: 0 };
  }

  const config = getModelConfig('claim_eval');

  // Prepare claims for prompt
  const claimsForPrompt = claims.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description,
    evidence: c.evidence.map(e => ({
      text: e.text,
      strength: e.strength,
    })),
  }));

  const prompt = CLAIM_EVAL_PROMPT.replace(
    '{claims_json}',
    JSON.stringify(claimsForPrompt, null, 2)
  );

  try {
    const response = await aiComplete(
      config.provider,
      config.model,
      {
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        jsonMode: true,
      },
      {
        operation: 'claim_eval',
        userId: options?.userId,
      }
    );

    // Parse response
    const parsed = JSON.parse(response.content) as GroundingResponse;

    // Convert to issues
    const issues: ClaimIssue[] = parsed.evaluations
      .filter(e => !e.grounded && e.issue)
      .map(e => ({
        claimId: e.claim_id,
        type: 'not_grounded' as const,
        severity: 'warning' as const,
        message: e.issue!,
      }));

    // Calculate cost (rough estimate based on tokens)
    const inputTokens = response.usage.inputTokens;
    const outputTokens = response.usage.outputTokens;
    const costCents = Math.round(
      (inputTokens * 0.003 + outputTokens * 0.015) / 10 // Claude Sonnet pricing
    );

    return { issues, costCents };
  } catch (error) {
    // On AI failure, flag all claims as unevaluated
    console.error('[claim-grounding] AI eval failed:', error);

    const issues: ClaimIssue[] = claims.map(c => ({
      claimId: c.id,
      type: 'unevaluated' as const,
      severity: 'warning' as const,
      message: 'Could not verify this claim - AI evaluation failed',
    }));

    return { issues, costCents: 0 };
  }
}
