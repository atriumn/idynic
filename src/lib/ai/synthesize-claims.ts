import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embeddings";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const openai = new OpenAI();

// Confidence base scores calibrated for evidence count
const CONFIDENCE_BASE = {
  SINGLE_EVIDENCE: 0.5,   // One data point is tentative
  DOUBLE_EVIDENCE: 0.7,   // Two corroborating sources
  TRIPLE_EVIDENCE: 0.8,   // Three sources provides high confidence
  MULTIPLE_EVIDENCE: 0.9, // 4+ sources is nearly certain
} as const;

// Strength multipliers for evidence quality
const STRENGTH_MULTIPLIER = {
  strong: 1.2,  // Direct, clear evidence
  medium: 1.0,  // Related evidence
  weak: 0.7,    // Tangential connection
} as const;

const MAX_CONFIDENCE = 0.95;
const MAX_EVIDENCE_TEXT_LENGTH = 5000;

interface CandidateClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
  similarity: number;
}

interface SynthesisResult {
  match: string | null;  // claim label if matched (used to find claim by label)
  strength: "weak" | "medium" | "strong";
  new_claim: {
    type: "skill" | "achievement" | "attribute" | "education" | "certification";
    label: string;
    description: string;
  } | null;
}

interface EvidenceItem {
  id: string;
  text: string;
  type: "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification";
  embedding: number[];
}

const SYNTHESIS_SYSTEM_PROMPT = `You are an identity synthesizer. Given evidence and candidate claims, determine if the evidence supports an existing claim or requires a new one. Return ONLY valid JSON.`;

// Map evidence types to claim types
const EVIDENCE_TO_CLAIM_TYPE: Record<EvidenceItem["type"], SynthesisResult["new_claim"] extends { type: infer T } | null ? T : never> = {
  skill_listed: "skill",
  accomplishment: "achievement",
  trait_indicator: "attribute",
  education: "education",
  certification: "certification",
};

function buildSynthesisPrompt(
  evidenceText: string,
  evidenceType: EvidenceItem["type"],
  candidates: CandidateClaim[]
): string {
  const candidateList = candidates.length > 0
    ? candidates.map((c, i) => `${i + 1}. "${c.label}" (${c.type}) - ${c.description || "No description"}`).join("\n")
    : "No existing claims yet.";

  const expectedClaimType = EVIDENCE_TO_CLAIM_TYPE[evidenceType];

  return `Given this evidence, determine if it supports an existing claim or requires a new one.

EVIDENCE: "${evidenceText}"
EVIDENCE TYPE: ${evidenceType} → This should become a "${expectedClaimType}" claim unless it clearly matches an existing claim of a different type.

CANDIDATE CLAIMS:
${candidateList}

Rules:
1. If evidence clearly supports an existing claim, return match with the claim's label
2. If evidence is a new capability/achievement/trait/degree/cert, create a new claim
3. New claim labels should be concise (2-4 words), semantic, and reusable
4. Strength: "strong" = direct evidence, "medium" = related, "weak" = tangential
5. IMPORTANT: Respect the evidence type when creating new claims:
   - skill_listed → skill (e.g., "Python", "Leadership", "Project Management")
   - accomplishment → achievement (e.g., "Performance Engineering", "Team Scaling")
   - trait_indicator → attribute (e.g., "Thrives in Ambiguity", "Growth Mindset")
   - education → education (e.g., "BS in Computer Science", "MBA")
   - certification → certification (e.g., "AWS Solutions Architect", "PMP")

Examples of good claim labels:
- "Performance Engineering" (not "Reduced API latency")
- "Distributed Team Leadership" (not "Led teams across continents")
- "Python" (skill names stay as-is)
- "Leadership" is a SKILL, not an achievement
- "BS in Management Information Systems" (education - include degree and major)
- "AWS Solutions Architect Professional" (certification - include full cert name)

Return JSON:
{
  "match": "Exact label of matched claim" or null,
  "strength": "weak" | "medium" | "strong",
  "new_claim": null or {"type": "skill|achievement|attribute|education|certification", "label": "...", "description": "..."}
}`;
}

function isValidNewClaim(claim: unknown): claim is SynthesisResult["new_claim"] {
  if (!claim || typeof claim !== "object") return false;
  const c = claim as Record<string, unknown>;
  return (
    typeof c.type === "string" &&
    ["skill", "achievement", "attribute", "education", "certification"].includes(c.type) &&
    typeof c.label === "string" &&
    c.label.length > 0 &&
    typeof c.description === "string"
  );
}

export async function synthesizeClaims(
  userId: string,
  evidenceItems: EvidenceItem[]
): Promise<{ claimsCreated: number; claimsUpdated: number }> {
  const supabase = await createClient();
  let claimsCreated = 0;
  let claimsUpdated = 0;

  for (const evidence of evidenceItems) {
    // Skip overly long evidence
    if (evidence.text.length > MAX_EVIDENCE_TEXT_LENGTH) {
      console.warn("Skipping evidence exceeding max length:", evidence.text.slice(0, 100));
      continue;
    }

    // 1. Find candidate claims via embedding similarity
    const { data: candidates } = await supabase.rpc("find_candidate_claims", {
      query_embedding: evidence.embedding as unknown as string,
      match_user_id: userId,
      match_count: 5,
    });

    // 2. AI decides: match existing or create new
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
        { role: "user", content: buildSynthesisPrompt(evidence.text, evidence.type, candidates || []) },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) continue;

    let result: SynthesisResult;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse synthesis result:", content);
      continue;
    }

    // 3. Update or create claim
    if (result.match && candidates) {
      // Find the matched claim
      const matchedClaim = candidates.find(c => c.label === result.match);
      if (matchedClaim) {
        // Link evidence to existing claim (upsert to handle duplicates)
        const { error: linkError } = await supabase
          .from("claim_evidence")
          .upsert(
            {
              claim_id: matchedClaim.id,
              evidence_id: evidence.id,
              strength: result.strength,
            },
            { onConflict: "claim_id,evidence_id", ignoreDuplicates: true }
          );

        if (linkError) {
          console.error("Failed to link evidence:", linkError);
          continue;
        }

        // Recalculate confidence
        await recalculateConfidence(supabase, matchedClaim.id);
        claimsUpdated++;
      }
    } else if (result.new_claim) {
      // Validate new_claim structure
      if (!isValidNewClaim(result.new_claim)) {
        console.error("Invalid new_claim structure:", result.new_claim);
        continue;
      }

      // Check if a claim with this label already exists (any type)
      const { data: existingClaim } = await supabase
        .from("identity_claims")
        .select("id")
        .eq("user_id", userId)
        .eq("label", result.new_claim.label)
        .single();

      if (existingClaim) {
        // Link evidence to existing claim instead of creating duplicate
        await supabase
          .from("claim_evidence")
          .upsert(
            {
              claim_id: existingClaim.id,
              evidence_id: evidence.id,
              strength: result.strength,
            },
            { onConflict: "claim_id,evidence_id", ignoreDuplicates: true }
          );
        await recalculateConfidence(supabase, existingClaim.id);
        claimsUpdated++;
        continue;
      }

      // Create new claim
      const claimEmbedding = await generateEmbedding(result.new_claim.label);

      const { data: newClaim, error } = await supabase
        .from("identity_claims")
        .insert({
          user_id: userId,
          type: result.new_claim.type,
          label: result.new_claim.label,
          description: result.new_claim.description,
          confidence: getBaseConfidence(1) * getStrengthMultiplier(result.strength),
          embedding: claimEmbedding as unknown as string,
        })
        .select()
        .single();

      if (newClaim && !error) {
        // Link evidence to new claim
        await supabase.from("claim_evidence").insert({
          claim_id: newClaim.id,
          evidence_id: evidence.id,
          strength: result.strength,
        });
        claimsCreated++;
      }
    }
  }

  return { claimsCreated, claimsUpdated };
}

async function recalculateConfidence(
  supabase: SupabaseClient<Database>,
  claimId: string
): Promise<void> {
  // Get all evidence for this claim
  const { data: links } = await supabase
    .from("claim_evidence")
    .select("strength")
    .eq("claim_id", claimId);

  if (!links || links.length === 0) return;

  const count = links.length;
  const avgMultiplier = links.reduce(
    (sum, l) => sum + getStrengthMultiplier(l.strength),
    0
  ) / count;

  const confidence = Math.min(MAX_CONFIDENCE, getBaseConfidence(count) * avgMultiplier);

  await supabase
    .from("identity_claims")
    .update({ confidence, updated_at: new Date().toISOString() })
    .eq("id", claimId);
}

function getBaseConfidence(evidenceCount: number): number {
  if (evidenceCount >= 4) return CONFIDENCE_BASE.MULTIPLE_EVIDENCE;
  if (evidenceCount === 3) return CONFIDENCE_BASE.TRIPLE_EVIDENCE;
  if (evidenceCount === 2) return CONFIDENCE_BASE.DOUBLE_EVIDENCE;
  return CONFIDENCE_BASE.SINGLE_EVIDENCE;
}

function getStrengthMultiplier(strength: string): number {
  return STRENGTH_MULTIPLIER[strength as keyof typeof STRENGTH_MULTIPLIER] ?? STRENGTH_MULTIPLIER.medium;
}
