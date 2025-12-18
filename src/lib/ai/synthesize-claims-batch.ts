import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "./embeddings";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const openai = new OpenAI();

const BATCH_SIZE = 10;
const MAX_CONFIDENCE = 0.95;

const CONFIDENCE_BASE = {
  SINGLE_EVIDENCE: 0.5,
  DOUBLE_EVIDENCE: 0.7,
  TRIPLE_EVIDENCE: 0.8,
  MULTIPLE_EVIDENCE: 0.9,
} as const;

const STRENGTH_MULTIPLIER = {
  strong: 1.2,
  medium: 1.0,
  weak: 0.7,
} as const;

interface EvidenceItem {
  id: string;
  text: string;
  type: "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification";
  embedding: number[];
}

interface ExistingClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
}

interface BatchDecision {
  evidence_id: string;
  match: string | null;
  strength: "weak" | "medium" | "strong";
  new_claim: {
    type: "skill" | "achievement" | "attribute" | "education" | "certification";
    label: string;
    description: string;
  } | null;
}

const EVIDENCE_TO_CLAIM_TYPE: Record<EvidenceItem["type"], string> = {
  skill_listed: "skill",
  accomplishment: "achievement",
  trait_indicator: "attribute",
  education: "education",
  certification: "certification",
};

const BATCH_SYSTEM_PROMPT = `You are an identity synthesizer. Given multiple evidence items and existing claims, determine if each evidence supports an existing claim or requires a new one. Return ONLY valid JSON array with one decision per evidence item.`;

function buildBatchPrompt(
  evidenceItems: EvidenceItem[],
  existingClaims: ExistingClaim[]
): string {
  const claimsList = existingClaims.length > 0
    ? existingClaims.map((c, i) => `${i + 1}. "${c.label}" (${c.type}) - ${c.description || "No description"}`).join("\n")
    : "No existing claims yet.";

  const evidenceList = evidenceItems.map((e, i) =>
    `${i + 1}. [ID: ${e.id}] "${e.text}" (type: ${e.type} → ${EVIDENCE_TO_CLAIM_TYPE[e.type]})`
  ).join("\n");

  return `For each evidence item, determine if it matches an existing claim or needs a new one.

EXISTING CLAIMS:
${claimsList}

EVIDENCE ITEMS:
${evidenceList}

Rules:
1. If evidence clearly supports an existing claim, return match with the claim's exact label
2. If evidence is new capability/achievement/trait/degree/cert, create a new claim
3. New claim labels: concise (2-4 words), semantic, reusable
4. Strength: "strong" = direct evidence, "medium" = related, "weak" = tangential
5. Respect evidence type → claim type mapping shown in parentheses

Return JSON array with EXACTLY ${evidenceItems.length} decisions, one per evidence item:
[
  {
    "evidence_id": "uuid-from-above",
    "match": "Exact label" or null,
    "strength": "weak" | "medium" | "strong",
    "new_claim": null or {"type": "skill|achievement|attribute|education|certification", "label": "...", "description": "..."}
  }
]`;
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export interface BatchSynthesisProgress {
  current: number;
  total: number;
}

export async function synthesizeClaimsBatch(
  userId: string,
  evidenceItems: EvidenceItem[],
  onProgress?: (progress: BatchSynthesisProgress) => void
): Promise<{ claimsCreated: number; claimsUpdated: number }> {
  const supabase = await createClient();
  let claimsCreated = 0;
  let claimsUpdated = 0;

  // Fetch all existing claims upfront (instead of per-item vector search)
  const { data: existingClaims } = await supabase
    .from("identity_claims")
    .select("id, type, label, description")
    .eq("user_id", userId)
    .order("label");

  const claims = existingClaims || [];
  const batches = chunk(evidenceItems, BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    onProgress?.({ current: batchIndex + 1, total: batches.length });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 2000,
        messages: [
          { role: "system", content: BATCH_SYSTEM_PROMPT },
          { role: "user", content: buildBatchPrompt(batch, claims) },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      let decisions: BatchDecision[];
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        decisions = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse batch synthesis result:", content);
        continue;
      }

      // Process each decision
      for (const decision of decisions) {
        const evidence = batch.find(e => e.id === decision.evidence_id);
        if (!evidence) continue;

        if (decision.match) {
          // Find matched claim by label
          const matchedClaim = claims.find(c => c.label === decision.match);
          if (matchedClaim) {
            await supabase
              .from("claim_evidence")
              .upsert(
                {
                  claim_id: matchedClaim.id,
                  evidence_id: evidence.id,
                  strength: decision.strength,
                },
                { onConflict: "claim_id,evidence_id", ignoreDuplicates: true }
              );
            await recalculateConfidence(supabase, matchedClaim.id);
            claimsUpdated++;
          }
        } else if (decision.new_claim) {
          // Check if claim with this label already exists
          const existingClaim = claims.find(c => c.label === decision.new_claim!.label);

          if (existingClaim) {
            // Link to existing instead of creating duplicate
            await supabase
              .from("claim_evidence")
              .upsert(
                {
                  claim_id: existingClaim.id,
                  evidence_id: evidence.id,
                  strength: decision.strength,
                },
                { onConflict: "claim_id,evidence_id", ignoreDuplicates: true }
              );
            await recalculateConfidence(supabase, existingClaim.id);
            claimsUpdated++;
          } else {
            // Create new claim
            const claimEmbedding = await generateEmbedding(decision.new_claim.label);

            const { data: newClaim, error } = await supabase
              .from("identity_claims")
              .insert({
                user_id: userId,
                type: decision.new_claim.type,
                label: decision.new_claim.label,
                description: decision.new_claim.description,
                confidence: getBaseConfidence(1) * getStrengthMultiplier(decision.strength),
                embedding: claimEmbedding as unknown as string,
              })
              .select()
              .single();

            if (newClaim && !error) {
              await supabase.from("claim_evidence").insert({
                claim_id: newClaim.id,
                evidence_id: evidence.id,
                strength: decision.strength,
              });
              // Add to local claims list for subsequent batches
              claims.push({
                id: newClaim.id,
                type: decision.new_claim.type,
                label: decision.new_claim.label,
                description: decision.new_claim.description,
              });
              claimsCreated++;
            }
          }
        }
      }
    } catch (err) {
      console.error(`Batch ${batchIndex + 1} failed:`, err);
      // Continue with remaining batches
    }
  }

  return { claimsCreated, claimsUpdated };
}

async function recalculateConfidence(
  supabase: SupabaseClient<Database>,
  claimId: string
): Promise<void> {
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
