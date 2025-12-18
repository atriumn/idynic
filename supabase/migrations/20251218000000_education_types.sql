-- Add education and certification types

-- Update evidence type check constraint
ALTER TABLE evidence DROP CONSTRAINT IF EXISTS evidence_evidence_type_check;
ALTER TABLE evidence ADD CONSTRAINT evidence_evidence_type_check
  CHECK (evidence_type IN ('accomplishment', 'skill_listed', 'trait_indicator', 'education', 'certification'));

-- Update identity_claims type check constraint
ALTER TABLE identity_claims DROP CONSTRAINT IF EXISTS identity_claims_type_check;
ALTER TABLE identity_claims ADD CONSTRAINT identity_claims_type_check
  CHECK (type IN ('skill', 'achievement', 'attribute', 'education', 'certification'));
