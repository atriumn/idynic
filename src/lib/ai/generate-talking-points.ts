import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI();

interface Strength {
  requirement: string;
  requirement_type: string;
  claim_id: string;
  claim_label: string;
  evidence_summary: string;
  framing: string;
  confidence: number;
}

interface Gap {
  requirement: string;
  requirement_type: string;
  mitigation: string;
  related_claims: string[];
}

interface Inference {
  inferred_claim: string;
  derived_from: string[];
  reasoning: string;
}

export interface TalkingPoints {
  strengths: Strength[];
  gaps: Gap[];
  inferences: Inference[];
}

interface ClaimWithEvidence {
  id: string;
  label: string;
  type: string;
  description: string | null;
  evidence: Array<{
    text: string;
    type: string;
    context: unknown;
  }>;
}

interface Requirement {
  text: string;
  type: string;
  category: "mustHave" | "niceToHave";
}

const SYSTEM_PROMPT = `You are a career coach helping candidates prepare for job applications. Analyze how a candidate's experience maps to job requirements. Be honest but strategic - find genuine strengths and acknowledge real gaps with constructive mitigation strategies.`;

function buildUserPrompt(requirements: Requirement[], claims: ClaimWithEvidence[]): string {
  return `Analyze this candidate's fit for a role. Return JSON with strengths, gaps, and inferences.

## Job Requirements

### Must Have:
${requirements.filter(r => r.category === "mustHave").map(r => `- ${r.text} (${r.type})`).join("\n")}

### Nice to Have:
${requirements.filter(r => r.category === "niceToHave").map(r => `- ${r.text} (${r.type})`).join("\n")}

## Candidate's Claims (with evidence)

${claims.map(c => `### ${c.label} (${c.type})
${c.description || ""}
Evidence:
${c.evidence.map(e => `- ${e.text}`).join("\n")}`).join("\n\n")}

## Instructions

1. **Strengths**: For each requirement the candidate meets, identify:
   - Which claim addresses it
   - A brief evidence summary
   - How to frame/position this strength (what angle to emphasize)
   - Confidence score (0-1)

2. **Gaps**: For requirements NOT met, provide:
   - Honest acknowledgment of the gap
   - Mitigation strategy (related experience, transferable skills, eagerness to learn)
   - Related claims that partially address it

3. **Inferences**: Reasonable conclusions from the evidence:
   - Skills or experience implied but not explicitly stated
   - What evidence supports the inference

Return JSON:
{
  "strengths": [
    {
      "requirement": "5+ years engineering experience",
      "requirement_type": "experience",
      "claim_id": "uuid-here",
      "claim_label": "Engineering Leadership",
      "evidence_summary": "Led teams at 3 companies over 8 years",
      "framing": "Emphasize progression from IC to leadership",
      "confidence": 0.95
    }
  ],
  "gaps": [
    {
      "requirement": "Kubernetes experience",
      "requirement_type": "skill",
      "mitigation": "Strong Docker and AWS ECS experience demonstrates container orchestration fundamentals. Express enthusiasm to expand into K8s.",
      "related_claims": ["uuid1", "uuid2"]
    }
  ],
  "inferences": [
    {
      "inferred_claim": "Stakeholder management",
      "derived_from": ["uuid1", "uuid2"],
      "reasoning": "Multiple instances of presenting to executives and coordinating across departments implies strong stakeholder management"
    }
  ]
}

IMPORTANT:
- Use actual claim IDs from the data provided
- Be honest about gaps - don't spin weaknesses as strengths
- Framing should be authentic emphasis, not keyword stuffing
- Return ONLY valid JSON`;
}

export async function generateTalkingPoints(
  opportunityId: string,
  userId: string
): Promise<TalkingPoints> {
  const supabase = await createClient();

  // Get opportunity requirements
  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .select("requirements")
    .eq("id", opportunityId)
    .single();

  if (oppError) {
    throw new Error(`Failed to load opportunity: ${oppError.message}`);
  }

  if (!opportunity?.requirements) {
    return { strengths: [], gaps: [], inferences: [] };
  }

  const reqs = opportunity.requirements as {
    mustHave?: Array<{ text: string; type: string }>;
    niceToHave?: Array<{ text: string; type: string }>;
  };

  const requirements: Requirement[] = [
    ...(reqs.mustHave || []).map((r) => ({ ...r, category: "mustHave" as const })),
    ...(reqs.niceToHave || []).map((r) => ({ ...r, category: "niceToHave" as const })),
  ];

  if (requirements.length === 0) {
    return { strengths: [], gaps: [], inferences: [] };
  }

  // Get user's claims with evidence
  const { data: claims, error: claimsError } = await supabase
    .from("identity_claims")
    .select(`
      id,
      label,
      type,
      description,
      claim_evidence (
        evidence:evidence_id (
          text,
          evidence_type,
          context
        )
      )
    `)
    .eq("user_id", userId);

  if (claimsError) {
    throw new Error(`Failed to load claims: ${claimsError.message}`);
  }

  const claimsWithEvidence: ClaimWithEvidence[] = (claims || []).map((c) => ({
    id: c.id,
    label: c.label,
    type: c.type,
    description: c.description,
    evidence: (c.claim_evidence || [])
      .map((ce: { evidence: { text: string; evidence_type: string; context: unknown } | null }) => ce.evidence)
      .filter((e): e is { text: string; evidence_type: string; context: unknown } => e !== null)
      .map((e) => ({
        text: e.text,
        type: e.evidence_type,
        context: e.context,
      })),
  }));

  // Return early if no claims to analyze
  if (claimsWithEvidence.length === 0) {
    return { strengths: [], gaps: [], inferences: [] };
  }

  // Generate talking points via LLM
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(requirements, claimsWithEvidence) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  try {
    const parsed = JSON.parse(content) as TalkingPoints;
    return {
      strengths: parsed.strengths || [],
      gaps: parsed.gaps || [],
      inferences: parsed.inferences || [],
    };
  } catch {
    throw new Error(`Failed to parse talking points: ${content.slice(0, 200)}`);
  }
}
