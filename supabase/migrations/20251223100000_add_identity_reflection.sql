-- Add identity reflection columns to profiles table
-- These fields store the AI-generated professional narrative

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_headline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_archetype TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_keywords JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_matches JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_generated_at TIMESTAMPTZ;

-- Add comment explaining the archetype constraint
COMMENT ON COLUMN profiles.identity_archetype IS 'One of: Builder, Optimizer, Connector, Guide, Stabilizer, Specialist, Strategist, Advocate, Investigator, Performer';
