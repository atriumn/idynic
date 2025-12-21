/**
 * RAG-based claim retrieval for synthesis
 *
 * Replaces full-context loading with vector search to find
 * semantically relevant claims for each evidence batch.
 */

import { createClient } from '@/lib/supabase/server';

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
 * @param userId - User whose claims to search
 * @param evidenceItems - Evidence with embeddings to match against
 * @param options - Threshold and limit configuration
 * @returns Deduplicated list of relevant claims
 */
export async function findRelevantClaimsForBatch(
  userId: string,
  evidenceItems: EvidenceWithEmbedding[],
  options: RAGOptions = {}
): Promise<RelevantClaim[]> {
  if (evidenceItems.length === 0) {
    return [];
  }

  const {
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    maxClaimsPerQuery = DEFAULT_MAX_CLAIMS,
  } = options;

  const supabase = await createClient();
  const claimsMap = new Map<string, RelevantClaim>();

  // Query for each evidence embedding
  for (const evidence of evidenceItems) {
    const { data, error } = await supabase.rpc('find_relevant_claims_for_synthesis', {
      query_embedding: evidence.embedding as unknown as string,
      p_user_id: userId,
      similarity_threshold: similarityThreshold,
      max_claims: maxClaimsPerQuery,
    });

    if (error) {
      console.error('RAG query failed:', error.message);
      continue;
    }

    // Add to map (deduplicates by id)
    for (const claim of data || []) {
      if (!claimsMap.has(claim.id)) {
        claimsMap.set(claim.id, claim);
      }
    }
  }

  return Array.from(claimsMap.values());
}
