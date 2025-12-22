-- Add LinkedIn job metadata columns to opportunities table
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS seniority_level text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS job_function text,
  ADD COLUMN IF NOT EXISTS industries text,
  ADD COLUMN IF NOT EXISTS salary_min integer,
  ADD COLUMN IF NOT EXISTS salary_max integer,
  ADD COLUMN IF NOT EXISTS salary_currency text,
  ADD COLUMN IF NOT EXISTS applicant_count integer,
  ADD COLUMN IF NOT EXISTS posted_date timestamptz,
  ADD COLUMN IF NOT EXISTS easy_apply boolean,
  ADD COLUMN IF NOT EXISTS company_logo_url text,
  ADD COLUMN IF NOT EXISTS description_html text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Add comment for source field
COMMENT ON COLUMN opportunities.source IS 'Source of opportunity data: manual (user-entered) or linkedin (enriched via Bright Data)';
