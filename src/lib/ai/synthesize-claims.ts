import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embeddings";

const openai = new OpenAI();

interface CandidateClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
  similarity: number;
}

interface SynthesisResult {
  match: string | null;  // claim ID if matched
  strength: "weak" | "medium" | "strong";
  new_claim: {
    type: "skill" | "achievement" | "attribute";
    label: string;
    description: string;
  } | null;
}

interface EvidenceItem {
  id: string;
  text: string;
  embedding: number[];
}

const SYNTHESIS_SYSTEM_PROMPT = `You are an identity synthesizer. Given evidence and candidate claims, determine if the evidence supports an existing claim or requires a new one. Return ONLY valid JSON.`;

function buildSynthesisPrompt(evidenceText: string, candidates: CandidateClaim[]): string {
  const candidateList = candidates.length > 0
    ? candidates.map((c, i) => `${i + 1}. "${c.label}" (${c.type}) - ${c.description || "No description"}`).join("\n")
    : "No existing claims yet.";

  return `Given this evidence, determine if it supports an existing claim or requires a new one.

EVIDENCE: "${evidenceText}"

CANDIDATE CLAIMS:
${candidateList}

Rules:
1. If evidence clearly supports an existing claim, return match with the claim's label
2. If evidence is a new capability/achievement/trait, create a new claim
3. New claim labels should be concise (2-4 words), semantic, and reusable
4. Strength: "strong" = direct evidence, "medium" = related, "weak" = tangential

Examples of good claim labels:
- "Performance Engineering" (not "Reduced API latency")
- "Distributed Team Leadership" (not "Led teams across continents")
- "Python" (skill names stay as-is)

Return JSON:
{
  "match": "Exact label of matched claim" or null,
  "strength": "weak" | "medium" | "strong",
  "new_claim": null or {"type": "skill|achievement|attribute", "label": "...", "description": "..."}
}`;
}

export async function synthesizeClaims(
  userId: string,
  evidenceItems: EvidenceItem[]
): Promise<{ claimsCreated: number; claimsUpdated: number }> {
  const supabase = await createClient();
  let claimsCreated = 0;
  let claimsUpdated = 0;

  for (const evidence of evidenceItems) {
    // 1. Find candidate claims via embedding similarity
    const { data: candidates } = await supabase.rpc("find_candidate_claims", {
      query_embedding: evidence.embedding,
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
        { role: "user", content: buildSynthesisPrompt(evidence.text, candidates || []) },
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
        // Link evidence to existing claim
        await supabase.from("claim_evidence").insert({
          claim_id: matchedClaim.id,
          evidence_id: evidence.id,
          strength: result.strength,
        });

        // Recalculate confidence
        await recalculateConfidence(supabase, matchedClaim.id);
        claimsUpdated++;
      }
    } else if (result.new_claim) {
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
          embedding: claimEmbedding,
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

async function recalculateConfidence(supabase: any, claimId: string): Promise<void> {
  // Get all evidence for this claim
  const { data: links } = await supabase
    .from("claim_evidence")
    .select("strength")
    .eq("claim_id", claimId);

  if (!links || links.length === 0) return;

  const count = links.length;
  const avgMultiplier = links.reduce((sum: number, l: { strength: string }) =>
    sum + getStrengthMultiplier(l.strength), 0) / count;

  const confidence = Math.min(0.95, getBaseConfidence(count) * avgMultiplier);

  await supabase
    .from("identity_claims")
    .update({ confidence, updated_at: new Date().toISOString() })
    .eq("id", claimId);
}

function getBaseConfidence(evidenceCount: number): number {
  if (evidenceCount >= 4) return 0.9;
  if (evidenceCount === 3) return 0.8;
  if (evidenceCount === 2) return 0.7;
  return 0.5;
}

function getStrengthMultiplier(strength: string): number {
  switch (strength) {
    case "strong": return 1.2;
    case "medium": return 1.0;
    case "weak": return 0.7;
    default: return 1.0;
  }
}
