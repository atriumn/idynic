-- Add columns for tracking original content and edits
ALTER TABLE tailored_profiles
ADD COLUMN IF NOT EXISTS resume_data_original jsonb,
ADD COLUMN IF NOT EXISTS narrative_original text,
ADD COLUMN IF NOT EXISTS edited_fields text[] DEFAULT '{}';
