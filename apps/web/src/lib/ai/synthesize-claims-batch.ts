import OpenAI from "openai";
import { generateEmbeddings } from "./embeddings";
import { findRelevantClaimsForBatch } from "./rag-claims";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  calculateClaimConfidence,
  type EvidenceInput,
  type ClaimType,
  type SourceType,
  type StrengthLevel,
} from "./confidence-scoring";

const openai = new OpenAI();

const BATCH_SIZE = 10;

interface EvidenceItem {
  id: string;
  text: string;
  type: "accomplishment" | "skill_listed" | "trait_indicator" | "education" | "certification";
  embedding: number[];
  sourceType?: 'resume' | 'story' | 'certification' | 'inferred';
  evidenceDate?: Date | null;
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
  existingClaims: Array<{ id?: string; type: string; label: string; description: string | null; confidence?: number; similarity?: number }>
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

export interface ClaimUpdate {
  action: "created" | "matched";
  label: string;
}

export async function synthesizeClaimsBatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  evidenceItems: EvidenceItem[],
  onProgress?: (progress: BatchSynthesisProgress) => void,
  onClaimUpdate?: (update: ClaimUpdate) => void
): Promise<{ claimsCreated: number; claimsUpdated: number }> {
  let claimsCreated = 0;
  let claimsUpdated = 0;

  // Track claims created locally during synthesis (for merging with RAG results)
  const claims: Array<{ id: string; type: string; label: string; description: string | null }> = [];
  const batches = chunk(evidenceItems, BATCH_SIZE);
  const claimIdsToRecalc = new Set<string>();

  // Collect claim updates for reveal-at-end UX
  const claimUpdates: ClaimUpdate[] = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    onProgress?.({ current: batchIndex + 1, total: batches.length });

    try {
      // RAG retrieval: Find relevant claims for this batch using vector search
      const relevantClaims = await findRelevantClaimsForBatch(
        userId,
        batch.map(e => ({ id: e.id, embedding: e.embedding }))
      );

      // Merge RAG results with locally tracked claims (created in previous batches)
      const allClaims: Array<{ id?: string; type: string; label: string; description: string | null; confidence?: number; similarity?: number }> = [...relevantClaims];
      for (const localClaim of claims) {
        if (!allClaims.find(c => c.id === localClaim.id)) {
          allClaims.push({
            ...localClaim,
            confidence: 0.5, // default for locally tracked
            similarity: 0, // not from vector search
          });
        }
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 2000,
        messages: [
          { role: "system", content: BATCH_SYSTEM_PROMPT },
          { role: "user", content: buildBatchPrompt(batch, allClaims) },
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

      // First pass: handle matches and collect new claims needing embeddings
      const newClaimsToCreate: Array<{
        decision: BatchDecision;
        evidence: EvidenceItem;
      }> = [];

      for (const decision of decisions) {
        const evidence = batch.find(e => e.id === decision.evidence_id);
        if (!evidence) continue;

        if (decision.match) {
          // Find matched claim by label
          const matchedClaim = allClaims.find(c => c.label === decision.match);
          if (matchedClaim && matchedClaim.id) {
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
            claimIdsToRecalc.add(matchedClaim.id);
            claimUpdates.push({ action: "matched", label: matchedClaim.label });
            claimsUpdated++;
          }
        } else if (decision.new_claim) {
          // Check if claim with this label already exists (in RAG results or local tracking)
          const existingClaim = allClaims.find(c => c.label === decision.new_claim!.label);

          if (existingClaim && existingClaim.id) {
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
            claimIdsToRecalc.add(existingClaim.id);
            claimUpdates.push({ action: "matched", label: existingClaim.label });
            claimsUpdated++;
          } else {
            // Collect for batch embedding generation
            newClaimsToCreate.push({ decision, evidence });
          }
        }
      }

      // Generate embeddings for all new claims in one batch call
      if (newClaimsToCreate.length > 0) {
        const labels = newClaimsToCreate.map(c => c.decision.new_claim!.label);
        const embeddings = await generateEmbeddings(labels);

        // Create all new claims with their embeddings
        for (let i = 0; i < newClaimsToCreate.length; i++) {
          const { decision, evidence } = newClaimsToCreate[i];
          const claimEmbedding = embeddings[i];

          // Calculate initial confidence for new claim
          const initialEvidence: EvidenceInput[] = [{
            strength: decision.strength as StrengthLevel,
            sourceType: (evidence.sourceType || 'resume') as SourceType,
            evidenceDate: evidence.evidenceDate || null,
            claimType: decision.new_claim!.type as ClaimType,
          }];

          const { data: newClaim, error } = await supabase
            .from("identity_claims")
            .insert({
              user_id: userId,
              type: decision.new_claim!.type,
              label: decision.new_claim!.label,
              description: decision.new_claim!.description,
              confidence: calculateClaimConfidence(initialEvidence),
              embedding: claimEmbedding as unknown as string,
            })
            .select()
            .single();

          if (error) {
            console.error("[synthesis] Failed to insert claim:", error, decision.new_claim);
          }

          if (newClaim && !error) {
            await supabase.from("claim_evidence").insert({
              claim_id: newClaim.id,
              evidence_id: evidence.id,
              strength: decision.strength,
            });
            // Add to local claims list for subsequent batches
            claims.push({
              id: newClaim.id,
              type: decision.new_claim!.type,
              label: decision.new_claim!.label,
              description: decision.new_claim!.description,
            });
            claimUpdates.push({ action: "created", label: decision.new_claim!.label });
            claimsCreated++;
          }
        }
      }
    } catch (err) {
      console.error(`Batch ${batchIndex + 1} failed:`, err);
      // Continue with remaining batches
    }
  }

  // Bulk recalculate confidence for all affected claims at the end
  if (claimIdsToRecalc.size > 0) {
    for (const claimId of Array.from(claimIdsToRecalc)) {
      await recalculateConfidence(supabase, claimId);
    }
  }

  // Reveal all claims at once (reveal-at-end UX)
  for (const update of claimUpdates) {
    onClaimUpdate?.(update);
  }

  return { claimsCreated, claimsUpdated };
}

async function recalculateConfidence(
  supabase: SupabaseClient<Database>,
  claimId: string
): Promise<void> {
  // Get claim type
  const { data: claim } = await supabase
    .from("identity_claims")
    .select("type")
    .eq("id", claimId)
    .single();

  if (!claim) return;

  // Get all evidence linked to this claim with metadata
  const { data: links } = await supabase
    .from("claim_evidence")
    .select(`
      strength,
      evidence:evidence_id (
        source_type,
        evidence_date
      )
    `)
    .eq("claim_id", claimId);

  if (!links || links.length === 0) return;

  // Build evidence inputs for scoring
  const evidenceItems: EvidenceInput[] = links.map(link => {
    const evidence = link.evidence as { source_type?: string; evidence_date?: string } | null;
    return {
      strength: (link.strength || 'medium') as StrengthLevel,
      sourceType: (evidence?.source_type || 'resume') as SourceType,
      evidenceDate: evidence?.evidence_date
        ? new Date(evidence.evidence_date)
        : null,
      claimType: claim.type as ClaimType,
    };
  });

  // Calculate new confidence using enhanced scoring
  const confidence = calculateClaimConfidence(evidenceItems);

  await supabase
    .from("identity_claims")
    .update({ confidence, updated_at: new Date().toISOString() })
    .eq("id", claimId);
}
