import { generateEmbeddings } from "./embeddings";
import { findRelevantClaimsForBatch } from "./rag-claims";
import { aiComplete } from "./gateway";
import { getModelConfig } from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  calculateClaimConfidence,
  type EvidenceInput,
  type ClaimType,
  type SourceType,
  type StrengthLevel,
} from "./confidence-scoring";
import { cosineSimilarity } from "./eval/rule-checks";

const BATCH_SIZE = 10;
const SEMANTIC_DEDUPE_THRESHOLD = 0.70; // Catch semantically similar claims like CI/CD variants

interface EvidenceItem {
  id: string;
  text: string;
  type:
    | "accomplishment"
    | "skill_listed"
    | "trait_indicator"
    | "education"
    | "certification";
  embedding: number[];
  sourceType?: "resume" | "story" | "certification" | "inferred";
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
  existingClaims: Array<{
    id?: string;
    type: string;
    label: string;
    description: string | null;
    confidence?: number;
    similarity?: number;
  }>,
): string {
  const claimsList =
    existingClaims.length > 0
      ? existingClaims
          .map(
            (c, i) =>
              `${i + 1}. "${c.label}" (${c.type}) - ${c.description || "No description"}`,
          )
          .join("\n")
      : "No existing claims yet.";

  const evidenceList = evidenceItems
    .map(
      (e, i) =>
        `${i + 1}. [ID: ${e.id}] "${e.text}" (type: ${e.type} → ${EVIDENCE_TO_CLAIM_TYPE[e.type]})`,
    )
    .join("\n");

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

CRITICAL - For skills, use the EXACT technology/tool name, NOT a category:
- "TypeScript" (NOT "Programming language")
- "React Native" (NOT "Mobile framework")
- "Next.js" (NOT "JavaScript framework")
- "PostgreSQL" (NOT "Database system")
- "Tailwind CSS" (NOT "CSS framework")

Description guidelines (IMPORTANT):
- Skills: Describe WHAT it is, never proficiency level. No "Proficiency in", "Familiarity with", "Expert in"
  Good: "Cloud infrastructure platform" for AWS, "JavaScript runtime" for Node.js
  Bad: "Proficiency in AWS", "Familiarity with Node.js"
- Achievements: What was accomplished and impact
- Attributes: What the trait means in practice

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

interface BatchResult {
  batchIndex: number;
  decisions: BatchDecision[];
  batch: EvidenceItem[];
}

async function processBatch(
  batch: EvidenceItem[],
  batchIndex: number,
  existingClaims: Array<{
    id?: string;
    type: string;
    label: string;
    description: string | null;
    confidence?: number;
    similarity?: number;
  }>,
  options?: { userId?: string; jobId?: string },
): Promise<BatchResult | null> {
  try {
    const config = getModelConfig("synthesize_claims");
    const response = await aiComplete(
      config.provider,
      config.model,
      {
        messages: [
          { role: "system", content: BATCH_SYSTEM_PROMPT },
          { role: "user", content: buildBatchPrompt(batch, existingClaims) },
        ],
        temperature: 0,
        maxTokens: 2000,
      },
      {
        operation: "synthesize_claims",
        userId: options?.userId,
        jobId: options?.jobId,
      },
    );

    const content = response.content;
    if (!content) return null;

    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const decisions = JSON.parse(cleaned) as BatchDecision[];

    return { batchIndex, decisions, batch };
  } catch (err) {
    console.error(`Batch ${batchIndex + 1} failed:`, err);
    return null;
  }
}

export async function synthesizeClaimsBatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  evidenceItems: EvidenceItem[],
  onProgress?: (progress: BatchSynthesisProgress) => void,
  onClaimUpdate?: (update: ClaimUpdate) => void,
  options?: { jobId?: string },
): Promise<{ claimsCreated: number; claimsUpdated: number }> {
  let claimsCreated = 0;
  let claimsUpdated = 0;

  const batches = chunk(evidenceItems, BATCH_SIZE);
  const claimIdsToRecalc = new Set<string>();

  // Pre-fetch all existing claims for this user via RAG (one query for all evidence)
  const existingClaims = await findRelevantClaimsForBatch(
    supabase,
    userId,
    evidenceItems.map((e) => ({ id: e.id, embedding: e.embedding })),
  );

  onProgress?.({ current: 0, total: batches.length });

  // Process all batches in parallel (limited concurrency)
  let completedCount = 0;
  const batchResults = await Promise.all(
    batches.map(async (batch, batchIndex) => {
      const result = await processBatch(batch, batchIndex, existingClaims, {
        userId,
        jobId: options?.jobId,
      });
      completedCount++;
      onProgress?.({ current: completedCount, total: batches.length });
      return result;
    }),
  );

  // Collect all decisions and dedupe new claims by label
  const newClaimsByLabel = new Map<
    string,
    {
      decision: BatchDecision;
      evidence: EvidenceItem;
    }
  >();
  const evidenceLinksToUpsert: Array<{
    claim_id: string;
    evidence_id: string;
    strength: string;
    label: string;
  }> = [];
  const pendingEvidenceLinks: Array<{
    label: string;
    evidence_id: string;
    strength: string;
  }> = [];

  for (const result of batchResults) {
    if (!result) continue;

    for (const decision of result.decisions) {
      const evidence = result.batch.find((e) => e.id === decision.evidence_id);
      if (!evidence) continue;

      if (decision.match) {
        const matchedClaim = existingClaims.find(
          (c) => c.label === decision.match,
        );
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
        const existingClaim = existingClaims.find(
          (c) => c.label === decision.new_claim!.label,
        );

        if (existingClaim && existingClaim.id) {
          evidenceLinksToUpsert.push({
            claim_id: existingClaim.id,
            evidence_id: evidence.id,
            strength: decision.strength,
            label: existingClaim.label,
          });
          claimIdsToRecalc.add(existingClaim.id);
        } else {
          // Dedupe by label - keep first occurrence
          if (!newClaimsByLabel.has(decision.new_claim.label)) {
            newClaimsByLabel.set(decision.new_claim.label, {
              decision,
              evidence,
            });
          }
          // Track all evidence that should link to this claim
          pendingEvidenceLinks.push({
            label: decision.new_claim.label,
            evidence_id: evidence.id,
            strength: decision.strength,
          });
        }
      }
    }
  }

  // Batch upsert evidence links for matched claims
  if (evidenceLinksToUpsert.length > 0) {
    const linksToInsert = evidenceLinksToUpsert.map(
      ({ claim_id, evidence_id, strength }) => ({
        claim_id,
        evidence_id,
        strength,
      }),
    );

    await supabase.from("claim_evidence").upsert(linksToInsert, {
      onConflict: "claim_id,evidence_id",
      ignoreDuplicates: true,
    });

    for (const link of evidenceLinksToUpsert) {
      onClaimUpdate?.({ action: "matched", label: link.label });
      claimsUpdated++;
    }
  }

  // Create new claims (deduped)
  const newClaimsArray = Array.from(newClaimsByLabel.values());
  if (newClaimsArray.length > 0) {
    const labels = newClaimsArray.map((c) => c.decision.new_claim!.label);

    // Check for existing claims by exact label match (RAG may have missed them)
    const { data: existingByLabel } = await supabase
      .from("identity_claims")
      .select("id, label")
      .eq("user_id", userId)
      .in("label", labels);

    const existingLabelMap = new Map(
      (existingByLabel || []).map((c) => [c.label, c.id]),
    );

    // Filter out claims that already exist (link evidence instead)
    const trulyNewClaims = newClaimsArray.filter(
      (item) => !existingLabelMap.has(item.decision.new_claim!.label),
    );
    const alreadyExistingClaims = newClaimsArray.filter((item) =>
      existingLabelMap.has(item.decision.new_claim!.label),
    );

    // Link evidence to existing claims that were missed by RAG
    if (alreadyExistingClaims.length > 0) {
      const linksForExisting = pendingEvidenceLinks
        .filter((link) => existingLabelMap.has(link.label))
        .map((link) => ({
          claim_id: existingLabelMap.get(link.label)!,
          evidence_id: link.evidence_id,
          strength: link.strength,
        }));

      if (linksForExisting.length > 0) {
        await supabase.from("claim_evidence").upsert(linksForExisting, {
          onConflict: "claim_id,evidence_id",
          ignoreDuplicates: true,
        });

        for (const item of alreadyExistingClaims) {
          onClaimUpdate?.({
            action: "matched",
            label: item.decision.new_claim!.label,
          });
          claimsUpdated++;
          claimIdsToRecalc.add(
            existingLabelMap.get(item.decision.new_claim!.label)!,
          );
        }
      }
    }

    // Only generate embeddings and insert for truly new claims
    if (trulyNewClaims.length > 0) {
      const trulyNewLabels = trulyNewClaims.map(
        (c) => c.decision.new_claim!.label,
      );
      const embeddings = await generateEmbeddings(trulyNewLabels);

      // Semantic deduplication: group similar new claims by embedding similarity
      const labelToCanonical = new Map<string, string>(); // maps each label to its canonical label
      const canonicalClaims: Array<{
        item: (typeof trulyNewClaims)[0];
        embedding: number[];
        index: number;
      }> = [];

      for (let i = 0; i < trulyNewClaims.length; i++) {
        const item = trulyNewClaims[i];
        const embedding = embeddings[i];
        const label = item.decision.new_claim!.label;

        // Check if this claim is similar to any existing canonical claim
        let foundCanonical = false;
        for (const canonical of canonicalClaims) {
          const similarity = cosineSimilarity(embedding, canonical.embedding);
          if (similarity >= SEMANTIC_DEDUPE_THRESHOLD) {
            // Map this label to the canonical label
            labelToCanonical.set(
              label,
              canonical.item.decision.new_claim!.label,
            );
            foundCanonical = true;
            console.log(
              `[synthesis] Deduped "${label}" -> "${canonical.item.decision.new_claim!.label}" (similarity: ${similarity.toFixed(3)})`,
            );
            break;
          }
        }

        if (!foundCanonical) {
          // This is a new canonical claim
          labelToCanonical.set(label, label);
          canonicalClaims.push({ item, embedding, index: i });
        }
      }

      // Update pending evidence links to use canonical labels
      for (const link of pendingEvidenceLinks) {
        const canonical = labelToCanonical.get(link.label);
        if (canonical && canonical !== link.label) {
          link.label = canonical;
        }
      }

      // Only insert canonical claims
      const claimsToInsert = canonicalClaims.map(({ item, embedding }) => {
        const initialEvidence: EvidenceInput[] = [
          {
            strength: item.decision.strength as StrengthLevel,
            sourceType: (item.evidence.sourceType || "resume") as SourceType,
            evidenceDate: item.evidence.evidenceDate || null,
            claimType: item.decision.new_claim!.type as ClaimType,
          },
        ];

        return {
          user_id: userId,
          type: item.decision.new_claim!.type,
          label: item.decision.new_claim!.label,
          description: item.decision.new_claim!.description,
          confidence: calculateClaimConfidence(initialEvidence),
          embedding: embedding as unknown as string,
        };
      });

      const { data: insertedClaims, error } = await supabase
        .from("identity_claims")
        .insert(claimsToInsert)
        .select();

      if (error) {
        console.error("[synthesis] Failed to batch insert claims:", error);
      }

      if (insertedClaims && !error) {
        // Build label -> claim_id map
        const labelToClaimId = new Map<string, string>();
        for (const claim of insertedClaims) {
          labelToClaimId.set(claim.label, claim.id);
          onClaimUpdate?.({ action: "created", label: claim.label });
          claimsCreated++;
        }

        // Link ALL evidence to their claims (not just the first one per label)
        const evidenceLinks = pendingEvidenceLinks
          .filter((link) => labelToClaimId.has(link.label))
          .map((link) => ({
            claim_id: labelToClaimId.get(link.label)!,
            evidence_id: link.evidence_id,
            strength: link.strength,
          }));

        if (evidenceLinks.length > 0) {
          await supabase.from("claim_evidence").upsert(evidenceLinks, {
            onConflict: "claim_id,evidence_id",
            ignoreDuplicates: true,
          });
        }
      }
    }
  }

  // Bulk recalculate confidence for all affected claims
  if (claimIdsToRecalc.size > 0) {
    await recalculateConfidenceBulk(supabase, Array.from(claimIdsToRecalc));
  }

  return { claimsCreated, claimsUpdated };
}

async function recalculateConfidenceBulk(
  supabase: SupabaseClient<Database>,
  claimIds: string[],
): Promise<void> {
  if (claimIds.length === 0) return;

  const { data: claimsWithEvidence } = await supabase
    .from("identity_claims")
    .select(
      `
      id,
      type,
      claim_evidence (
        strength,
        evidence:evidence_id (
          source_type,
          evidence_date
        )
      )
    `,
    )
    .in("id", claimIds);

  if (!claimsWithEvidence || claimsWithEvidence.length === 0) return;

  const updates: Array<{ id: string; confidence: number; updated_at: string }> =
    [];

  for (const claim of claimsWithEvidence) {
    const links = claim.claim_evidence || [];
    if (links.length === 0) continue;

    const evidenceInputs: EvidenceInput[] = links.map((link) => {
      const evidence = link.evidence as {
        source_type?: string;
        evidence_date?: string;
      } | null;
      return {
        strength: (link.strength || "medium") as StrengthLevel,
        sourceType: (evidence?.source_type || "resume") as SourceType,
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

  if (updates.length > 0) {
    await Promise.all(
      updates.map(({ id, confidence, updated_at }) =>
        supabase
          .from("identity_claims")
          .update({ confidence, updated_at })
          .eq("id", id),
      ),
    );
  }
}
