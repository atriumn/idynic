-- Backfill source_type for existing evidence
-- All existing evidence came from resume uploads, so set to 'resume'
-- Future evidence from stories will be set to 'story' at insert time

UPDATE evidence
SET source_type = 'resume'
WHERE source_type IS NULL;

-- Make source_type NOT NULL now that backfill is complete
ALTER TABLE evidence
ALTER COLUMN source_type SET NOT NULL;
