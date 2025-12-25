-- Document processing jobs table
-- Tracks job state for resume/story processing with Realtime updates
-- Replaces SSE-based streaming for better cross-platform support

CREATE TABLE document_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

  -- Job type and input
  job_type TEXT NOT NULL CHECK (job_type IN ('resume', 'story')),
  filename TEXT,
  content_hash TEXT,

  -- Processing state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  phase TEXT CHECK (phase IN ('validating', 'parsing', 'extracting', 'embeddings', 'synthesis', 'reflection')),
  progress TEXT,

  -- Real highlights from processing (not ticker messages)
  highlights JSONB DEFAULT '[]',

  -- Result or error
  error TEXT,
  warning TEXT,
  summary JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_document_jobs_user_id ON document_jobs(user_id);
CREATE INDEX idx_document_jobs_status ON document_jobs(status);
CREATE INDEX idx_document_jobs_created_at ON document_jobs(created_at);

-- Enable RLS
ALTER TABLE document_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view own jobs"
  ON document_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own jobs (for client-initiated jobs)
CREATE POLICY "Users can insert own jobs"
  ON document_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Note: Updates are done via service role (bypasses RLS) from backend

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_document_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_jobs_updated_at
  BEFORE UPDATE ON document_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_document_jobs_updated_at();

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE document_jobs;
