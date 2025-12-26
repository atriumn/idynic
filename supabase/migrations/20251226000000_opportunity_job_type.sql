-- Add 'opportunity' to the document_jobs job_type constraint
ALTER TABLE document_jobs
DROP CONSTRAINT IF EXISTS document_jobs_job_type_check;

ALTER TABLE document_jobs
ADD CONSTRAINT document_jobs_job_type_check
CHECK (job_type IN ('resume', 'story', 'opportunity'));

-- Add opportunity-specific phases
ALTER TABLE document_jobs
DROP CONSTRAINT IF EXISTS document_jobs_phase_check;

ALTER TABLE document_jobs
ADD CONSTRAINT document_jobs_phase_check
CHECK (phase IN ('validating', 'parsing', 'extracting', 'embeddings', 'synthesis', 'reflection', 'enriching', 'researching'));

-- Add opportunity_id column to link jobs to opportunities
ALTER TABLE document_jobs
ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
