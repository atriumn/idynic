-- RAG retrieval function for synthesis
-- Returns claims semantically similar to a query embedding
-- Used to provide focused context instead of loading all claims

CREATE OR REPLACE FUNCTION find_relevant_claims_for_synthesis(
  query_embedding vector(1536),
  p_user_id uuid,
  similarity_threshold float DEFAULT 0.50,
  max_claims int DEFAULT 25
)
RETURNS TABLE (
  id uuid,
  type text,
  label text,
  description text,
  confidence float,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    identity_claims.id,
    identity_claims.type,
    identity_claims.label,
    identity_claims.description,
    identity_claims.confidence,
    1 - (identity_claims.embedding <=> query_embedding) AS similarity
  FROM identity_claims
  WHERE identity_claims.user_id = p_user_id
    AND 1 - (identity_claims.embedding <=> query_embedding) > similarity_threshold
  ORDER BY identity_claims.embedding <=> query_embedding
  LIMIT max_claims;
$$;

COMMENT ON FUNCTION find_relevant_claims_for_synthesis IS
  'RAG retrieval for synthesis: finds claims similar to query embedding above threshold';
