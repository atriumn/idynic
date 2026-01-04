/**
 * AI-based tailoring evaluation
 * Checks generated profiles for hallucinations, missed opportunities, and gaps
 */

import { aiComplete } from "../gateway";
import { getModelConfig } from "../config";
import { calculateCostCents } from "../pricing";

export interface UserClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
}

export interface JobRequirement {
  category: string;
  requirement: string;
  priority: "must_have" | "nice_to_have";
}

export interface Hallucination {
  text: string;
  issue: string;
}

export interface MissedOpportunity {
  requirement: string;
  matching_claim: string;
}

export interface Gap {
  requirement: string;
  note: string;
}

export interface TailoringEvalResult {
  passed: boolean;
  grounding: {
    passed: boolean;
    hallucinations: Hallucination[];
  };
  utilization: {
    missed: MissedOpportunity[];
  };
  gaps: Gap[];
  model: string;
  costCents: number;
}

interface TailoringEvalResponse {
  grounding: {
    passed: boolean;
    hallucinations: Hallucination[];
  };
  utilization: {
    missed: MissedOpportunity[];
  };
  gaps: Gap[];
}

const TAILORING_EVAL_PROMPT = `You are evaluating a tailored job profile for truthfulness.

The user's verified claims (source of truth):
{claims_json}

The generated profile content:
{profile_content}

Check every skill, experience, or qualification mentioned in the profile.
Flag as hallucination if it's NOT supported by the user's claims.

Also identify:
- Missed opportunities: relevant claims that match job requirements but weren't highlighted
- Gaps: job requirements the user doesn't have (informational only)

Be strict about hallucinations:
- The profile should only contain information that can be traced back to user claims
- Slight rephrasing is OK, but inventing new skills or experiences is not
- Quantitative claims (years of experience, percentages) must be supported

Be helpful with missed opportunities:
- Look for claims that could address job requirements but weren't used

Respond with JSON:
{
  "grounding": {
    "passed": true|false,
    "hallucinations": [
      { "text": "what the profile claimed", "issue": "not found in user claims" }
    ]
  },
  "utilization": {
    "missed": [
      { "requirement": "AWS experience", "matching_claim": "Cloud Infrastructure Management" }
    ]
  },
  "gaps": [
    { "requirement": "5+ years Python", "note": "User has 3 years" }
  ]
}`;

/**
 * Evaluate a tailored profile for grounding and utilization
 */
export async function evaluateTailoredProfile(params: {
  tailoredProfileId: string;
  userId: string;
  narrative: string | null;
  resumeData: unknown;
  userClaims: UserClaim[];
  jobRequirements?: JobRequirement[];
}): Promise<TailoringEvalResult> {
  const { narrative, resumeData, userClaims, jobRequirements } = params;

  const config = getModelConfig("tailoring_eval");

  // Build profile content string
  const profileParts: string[] = [];
  if (narrative) {
    profileParts.push(`Narrative:\n${narrative}`);
  }
  if (resumeData) {
    profileParts.push(`Resume Data:\n${JSON.stringify(resumeData, null, 2)}`);
  }
  const profileContent = profileParts.join("\n\n");

  // Build claims summary
  const claimsSummary = userClaims.map((c) => ({
    type: c.type,
    label: c.label,
    description: c.description,
  }));

  // Build prompt
  let prompt = TAILORING_EVAL_PROMPT.replace(
    "{claims_json}",
    JSON.stringify(claimsSummary, null, 2),
  ).replace("{profile_content}", profileContent);

  // Add job requirements if available
  if (jobRequirements && jobRequirements.length > 0) {
    prompt += `\n\nJob requirements to check against:\n${JSON.stringify(jobRequirements, null, 2)}`;
  }

  try {
    const response = await aiComplete(
      config.provider,
      config.model,
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        jsonMode: true,
      },
      {
        operation: "tailoring_eval",
        userId: params.userId,
      },
    );

    const parsed = JSON.parse(response.content) as TailoringEvalResponse;

    const costCents = calculateCostCents(
      config.provider,
      config.model,
      response.usage.inputTokens,
      response.usage.outputTokens,
    );

    return {
      passed: parsed.grounding.passed,
      grounding: parsed.grounding,
      utilization: parsed.utilization,
      gaps: parsed.gaps,
      model: config.model,
      costCents,
    };
  } catch (error) {
    console.error("[tailoring-grounding] AI eval failed:", error);

    // On failure, return a cautious result
    return {
      passed: false,
      grounding: {
        passed: false,
        hallucinations: [
          {
            text: "Evaluation failed",
            issue: "Could not verify profile content - AI evaluation failed",
          },
        ],
      },
      utilization: { missed: [] },
      gaps: [],
      model: config.model,
      costCents: 0,
    };
  }
}

/**
 * Get user claims from database for evaluation
 */
export async function getUserClaimsForEval(
  supabase: { from: (table: string) => unknown },
  userId: string,
): Promise<UserClaim[]> {
  const { data: claims } = await (
    supabase.from("identity_claims") as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ data: UserClaim[] | null }>;
      };
    }
  )
    .select("id, type, label, description")
    .eq("user_id", userId);

  return claims || [];
}
