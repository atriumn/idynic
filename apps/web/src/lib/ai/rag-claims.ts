/**
 * RAG-based claim retrieval for synthesis
 *
 * Replaces full-context loading with vector search to find
 * semantically relevant claims for each evidence batch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface RelevantClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
  similarity: number;
}

export interface EvidenceWithEmbedding {
  id: string;
  embedding: number[];
}

export interface RAGOptions {
  similarityThreshold?: number;
  maxClaimsPerQuery?: number;
}

const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
const DEFAULT_MAX_CLAIMS = 25;

/**
 * Find relevant claims for a batch of evidence items
 *
 * Queries the vector database for each evidence embedding,
 * then deduplicates results to create focused LLM context.
 *
 * @param supabase - Supabase client to use for queries
 * @param userId - User whose claims to search
 * @param evidenceItems - Evidence with embeddings to match against
 * @param options - Threshold and limit configuration
 * @returns Deduplicated list of relevant claims
 */
export async function findRelevantClaimsForBatch(
  supabase: SupabaseClient<Database>,
  userId: string,
  evidenceItems: EvidenceWithEmbedding[],
  options: RAGOptions = {},
): Promise<RelevantClaim[]> {
  if (evidenceItems.length === 0) {
    return [];
  }

  const {
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    maxClaimsPerQuery = DEFAULT_MAX_CLAIMS,
  } = options;
  const claimsMap = new Map<string, RelevantClaim>();

  // Query all evidence embeddings in parallel
  const results = await Promise.all(
    evidenceItems.map((evidence) =>
      supabase.rpc("find_relevant_claims_for_synthesis", {
        query_embedding: evidence.embedding as unknown as string,
        p_user_id: userId,
        similarity_threshold: similarityThreshold,
        max_claims: maxClaimsPerQuery,
      }),
    ),
  );

  // Deduplicate results
  for (const { data, error } of results) {
    if (error) {
      console.error("RAG query failed:", error.message);
      continue;
    }

    for (const claim of data || []) {
      if (!claimsMap.has(claim.id)) {
        claimsMap.set(claim.id, claim);
      }
    }
  }

  return Array.from(claimsMap.values());
}
