-- Add 'tailor' to the document_jobs job_type constraint
-- And add tailor-specific phases: analyzing, generating, evaluating

ALTER TABLE document_jobs
DROP CONSTRAINT IF EXISTS document_jobs_job_type_check;

ALTER TABLE document_jobs
ADD CONSTRAINT document_jobs_job_type_check
CHECK (job_type IN ('resume', 'story', 'opportunity', 'tailor'));

-- Add tailor-specific phases
ALTER TABLE document_jobs
DROP CONSTRAINT IF EXISTS document_jobs_phase_check;

ALTER TABLE document_jobs
ADD CONSTRAINT document_jobs_phase_check
CHECK (phase IN (
  'validating', 'parsing', 'extracting', 'embeddings', 'synthesis', 'reflection',
  'enriching', 'researching',
  'analyzing', 'generating', 'evaluating'
));

-- Add tailored_profile_id column to link tailor jobs to profiles
ALTER TABLE document_jobs
ADD COLUMN IF NOT EXISTS tailored_profile_id UUID REFERENCES tailored_profiles(id) ON DELETE SET NULL;

-- Add index for tailored_profile_id lookups
CREATE INDEX IF NOT EXISTS idx_document_jobs_tailored_profile_id ON document_jobs(tailored_profile_id);
