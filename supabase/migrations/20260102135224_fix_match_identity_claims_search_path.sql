-- Fix search_path for match_identity_claims function
CREATE OR REPLACE FUNCTION public.match_identity_claims(
  query_embedding vector,
  match_user_id uuid,
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE(
  id uuid,
  type text,
  label text,
  description text,
  confidence double precision,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    identity_claims.id,
    identity_claims.type,
    identity_claims.label,
    identity_claims.description,
    identity_claims.confidence,
    1 - (identity_claims.embedding <=> query_embedding) AS similarity
  FROM identity_claims
  WHERE identity_claims.user_id = match_user_id
    AND 1 - (identity_claims.embedding <=> query_embedding) > match_threshold
  ORDER BY identity_claims.embedding <=> query_embedding
  LIMIT match_count;
$function$;
