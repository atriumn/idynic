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

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    onProgress?.({ current: batchIndex + 1, total: batches.length });

    try {
      // RAG retrieval: Find relevant claims for this batch using vector search
      const relevantClaims = await findRelevantClaimsForBatch(
        supabase,
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

      // First pass: categorize decisions and collect data for batch operations
      const newClaimsToCreate: Array<{
        decision: BatchDecision;
        evidence: EvidenceItem;
      }> = [];

      const evidenceLinksToUpsert: Array<{
        claim_id: string;
        evidence_id: string;
        strength: string;
        label: string;
      }> = [];

      for (const decision of decisions) {
        const evidence = batch.find(e => e.id === decision.evidence_id);
        if (!evidence) continue;

        if (decision.match) {
          // Find matched claim by label
          const matchedClaim = allClaims.find(c => c.label === decision.match);
          if (matchedClaim && matchedClaim.id) {
            evidenceLinksToUpsert.push({
              claim_id: matchedClaim.id,
              evidence_id: evidence.id,
              strength: decision.strength,
              label: matchedClaim.label,
            });
            claimIdsToRecalc.add(matchedClaim.id);
          }
        } else if (decision.new_claim) {
          // Check if claim with this label already exists (in RAG results or local tracking)
          const existingClaim = allClaims.find(c => c.label === decision.new_claim!.label);

          if (existingClaim && existingClaim.id) {
            // Link to existing instead of creating duplicate
            evidenceLinksToUpsert.push({
              claim_id: existingClaim.id,
              evidence_id: evidence.id,
              strength: decision.strength,
              label: existingClaim.label,
            });
            claimIdsToRecalc.add(existingClaim.id);
          } else {
            // Collect for batch embedding generation
            newClaimsToCreate.push({ decision, evidence });
          }
        }
      }

      // Batch upsert all evidence links for matched claims
      if (evidenceLinksToUpsert.length > 0) {
        const linksToInsert = evidenceLinksToUpsert.map(({ claim_id, evidence_id, strength }) => ({
          claim_id,
          evidence_id,
          strength,
        }));

        await supabase
          .from("claim_evidence")
          .upsert(linksToInsert, { onConflict: "claim_id,evidence_id", ignoreDuplicates: true });

        // Stream updates immediately
        for (const link of evidenceLinksToUpsert) {
          onClaimUpdate?.({ action: "matched", label: link.label });
          claimsUpdated++;
        }
      }

      // Generate embeddings for all new claims in one batch call
      if (newClaimsToCreate.length > 0) {
        const labels = newClaimsToCreate.map(c => c.decision.new_claim!.label);
        const embeddings = await generateEmbeddings(labels);

        // Build batch insert payload for all new claims
        const claimsToInsert = newClaimsToCreate.map((item, i) => {
          const initialEvidence: EvidenceInput[] = [{
            strength: item.decision.strength as StrengthLevel,
            sourceType: (item.evidence.sourceType || 'resume') as SourceType,
            evidenceDate: item.evidence.evidenceDate || null,
            claimType: item.decision.new_claim!.type as ClaimType,
          }];

          return {
            user_id: userId,
            type: item.decision.new_claim!.type,
            label: item.decision.new_claim!.label,
            description: item.decision.new_claim!.description,
            confidence: calculateClaimConfidence(initialEvidence),
            embedding: embeddings[i] as unknown as string,
          };
        });

        // Single batch insert for all new claims
        const { data: insertedClaims, error } = await supabase
          .from("identity_claims")
          .insert(claimsToInsert)
          .select();

        if (error) {
          console.error("[synthesis] Failed to batch insert claims:", error);
        }

        if (insertedClaims && !error) {
          // Build claim_evidence links for batch insert
          const evidenceLinks = insertedClaims.map((claim, i) => ({
            claim_id: claim.id,
            evidence_id: newClaimsToCreate[i].evidence.id,
            strength: newClaimsToCreate[i].decision.strength,
          }));

          // Single batch insert for all evidence links
          await supabase.from("claim_evidence").insert(evidenceLinks);

          // Update local tracking for subsequent batches + stream immediately
          for (const claim of insertedClaims) {
            claims.push({
              id: claim.id,
              type: claim.type,
              label: claim.label,
              description: claim.description,
            });
            onClaimUpdate?.({ action: "created", label: claim.label });
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
    await recalculateConfidenceBulk(supabase, Array.from(claimIdsToRecalc));
  }

  return { claimsCreated, claimsUpdated };
}

async function recalculateConfidenceBulk(
  supabase: SupabaseClient<Database>,
  claimIds: string[]
): Promise<void> {
  if (claimIds.length === 0) return;

  // Fetch all claims and their evidence links in one query
  const { data: claimsWithEvidence } = await supabase
    .from("identity_claims")
    .select(`
      id,
      type,
      claim_evidence (
        strength,
        evidence:evidence_id (
          source_type,
          evidence_date
        )
      )
    `)
    .in("id", claimIds);

  if (!claimsWithEvidence || claimsWithEvidence.length === 0) return;

  // Calculate new confidence for each claim
  const updates: Array<{ id: string; confidence: number; updated_at: string }> = [];

  for (const claim of claimsWithEvidence) {
    const links = claim.claim_evidence || [];
    if (links.length === 0) continue;

    const evidenceInputs: EvidenceInput[] = links.map(link => {
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

    updates.push({
      id: claim.id,
      confidence: calculateClaimConfidence(evidenceInputs),
      updated_at: new Date().toISOString(),
    });
  }

  // Batch update all claims in parallel
  if (updates.length > 0) {
    await Promise.all(
      updates.map(({ id, confidence, updated_at }) =>
        supabase
          .from("identity_claims")
          .update({ confidence, updated_at })
          .eq("id", id)
      )
    );
  }
}
