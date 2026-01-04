-- Fix search_path for match_claims function
CREATE OR REPLACE FUNCTION public.match_claims(
  query_embedding vector,
  match_user_id uuid,
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE(
  id uuid,
  claim_type text,
  value jsonb,
  evidence_text text,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    claims.id,
    claims.claim_type,
    claims.value,
    claims.evidence_text,
    1 - (claims.embedding <=> query_embedding) as similarity
  from claims
  where claims.user_id = match_user_id
    and 1 - (claims.embedding <=> query_embedding) > match_threshold
  order by claims.embedding <=> query_embedding
  limit match_count;
$function$;
