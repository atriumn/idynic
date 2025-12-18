-- Identity Synthesis Schema Migration
-- Adds evidence and identity_claims tables, keeps claims for backward compat during transition

-- 1. Evidence table (raw facts from sources)
CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('accomplishment', 'skill_listed', 'trait_indicator')),
  text text NOT NULL,
  context jsonb,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- 2. Identity Claims table (synthesized from evidence)
CREATE TABLE identity_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('skill', 'achievement', 'attribute')),
  label text NOT NULL,
  description text,
  confidence float DEFAULT 0.5,
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Link table (evidence supports claims)
CREATE TABLE claim_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES identity_claims(id) ON DELETE CASCADE NOT NULL,
  evidence_id uuid REFERENCES evidence(id) ON DELETE CASCADE NOT NULL,
  strength text NOT NULL CHECK (strength IN ('weak', 'medium', 'strong')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(claim_id, evidence_id)
);

-- Indexes
CREATE INDEX evidence_user_idx ON evidence(user_id);
CREATE INDEX evidence_document_idx ON evidence(document_id);
CREATE INDEX evidence_embedding_idx ON evidence USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX identity_claims_user_idx ON identity_claims(user_id);
CREATE INDEX identity_claims_embedding_idx ON identity_claims USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX claim_evidence_claim_idx ON claim_evidence(claim_id);
CREATE INDEX claim_evidence_evidence_idx ON claim_evidence(evidence_id);

-- RLS
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own evidence" ON evidence FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own identity_claims" ON identity_claims FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own claim_evidence" ON claim_evidence FOR ALL
  USING (EXISTS (SELECT 1 FROM identity_claims WHERE id = claim_id AND user_id = auth.uid()));

-- Vector search function for identity claims
CREATE OR REPLACE FUNCTION match_identity_claims(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float,
  match_count int
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
  WHERE identity_claims.user_id = match_user_id
    AND 1 - (identity_claims.embedding <=> query_embedding) > match_threshold
  ORDER BY identity_claims.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function to find candidate claims for synthesis
CREATE OR REPLACE FUNCTION find_candidate_claims(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 5
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
  WHERE identity_claims.user_id = match_user_id
  ORDER BY identity_claims.embedding <=> query_embedding
  LIMIT match_count;
$$;
