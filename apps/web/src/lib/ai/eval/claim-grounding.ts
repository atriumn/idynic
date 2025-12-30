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
  issue?: string | null; // Legacy field for backwards compatibility
  quality_issue?: string | null;
}

interface GroundingResponse {
  evaluations: GroundingEvaluation[];
}

const CLAIM_EVAL_PROMPT = `You are evaluating identity claims for grounding AND semantic quality.

Claims to evaluate:
{claims_json}

Each claim includes:
- label: the claim name (e.g., "React Development")
- description: what the user claims
- evidence: array of supporting evidence texts with their strength ratings

For each claim, check TWO things:

1. GROUNDING: Is the claim supported by evidence?
   - grounded = true if evidence reasonably supports the claim
   - grounded = false if claim overstates, misrepresents, or lacks evidence

2. QUALITY: Is this a meaningful professional identity claim?
   - quality_issue = null if the claim represents a real skill, achievement, or attribute
   - quality_issue = explanation if the claim is problematic

LOW QUALITY claims to flag:
- Raw metrics restated as claims: "Delivered Commits", "Made Pull Requests", "Wrote Lines of Code"
- Generic activity verbs: "Worked on Projects", "Used Tools", "Did Development"
- Metrics without abstraction: "High Commit Count" (vs good: "High Development Velocity")
- Non-transferable specifics: "411 Commits in 13 Days" (this is evidence, not a claim)

GOOD claims (don't flag):
- Skills: "React Development", "AWS Infrastructure", "PostgreSQL"
- Achievements: "Shipped Production Platform", "Led Team of 5", "Reduced Latency 50%"
- Attributes: "High Development Velocity", "Quality-Focused Engineering"
- Roles: "Technical Leadership", "Full-Stack Development"

Respond with JSON only:
{
  "evaluations": [
    { "claim_id": "uuid", "grounded": true, "quality_issue": null },
    { "claim_id": "uuid", "grounded": true, "quality_issue": "Restates raw metric - 'Delivered Commits' should be abstracted to a meaningful attribute" },
    { "claim_id": "uuid", "grounded": false, "quality_issue": null }
  ]
}`;

/**
 * Run AI grounding check on claims
 * Returns issues for claims that are not grounded in evidence
 */
export async function runClaimGroundingEval(
  claims: ClaimWithEvidence[],
  options?: { userId?: string; jobId?: string }
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
        jobId: options?.jobId,
      }
    );

    // Parse response - strip markdown code blocks if present
    let content = response.content;
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(content) as GroundingResponse;

    // Convert to issues - check both grounding and quality
    const issues: ClaimIssue[] = [];

    for (const e of parsed.evaluations) {
      // Grounding issue
      if (!e.grounded) {
        issues.push({
          claimId: e.claim_id,
          type: 'not_grounded' as const,
          severity: 'warning' as const,
          message: e.issue || 'Claim is not supported by evidence',
        });
      }

      // Quality issue (can exist even if grounded)
      if (e.quality_issue) {
        issues.push({
          claimId: e.claim_id,
          type: 'low_quality' as const,
          severity: 'warning' as const,
          message: e.quality_issue,
        });
      }
    }

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
