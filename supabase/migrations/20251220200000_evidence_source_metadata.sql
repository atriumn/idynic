-- Add source metadata columns to evidence table for enhanced confidence scoring
-- source_type: Indicates where evidence came from (resume, story, certification, inferred)
-- evidence_date: When the evidence occurred (for recency decay calculations)

ALTER TABLE evidence
ADD COLUMN source_type text
  CHECK (source_type IN ('resume', 'story', 'certification', 'inferred'))
  DEFAULT 'resume';

ALTER TABLE evidence
ADD COLUMN evidence_date date;

-- Add index for filtering by source type
CREATE INDEX evidence_source_type_idx ON evidence(source_type);

-- Add index for date-based queries
CREATE INDEX evidence_date_idx ON evidence(evidence_date);

COMMENT ON COLUMN evidence.source_type IS 'Source of evidence: resume, story, certification, or inferred';
COMMENT ON COLUMN evidence.evidence_date IS 'When this evidence occurred, used for recency decay';
