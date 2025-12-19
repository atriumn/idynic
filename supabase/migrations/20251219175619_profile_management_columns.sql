-- Add logo_url to profiles for personal branding
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url text;
COMMENT ON COLUMN profiles.logo_url IS 'URL to user personal logo/branding image for resume header';

-- Add source tracking to identity_claims
ALTER TABLE identity_claims ADD COLUMN IF NOT EXISTS source text DEFAULT 'extracted'
  CHECK (source IN ('extracted', 'manual'));
COMMENT ON COLUMN identity_claims.source IS 'Whether claim was extracted from documents or manually added by user';
