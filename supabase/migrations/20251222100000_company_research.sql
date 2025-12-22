-- Add company research columns to opportunities table
-- Populated via Tavily searches + GPT synthesis

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS company_url text,
  ADD COLUMN IF NOT EXISTS company_is_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_stock_ticker text,
  ADD COLUMN IF NOT EXISTS company_industry text,
  ADD COLUMN IF NOT EXISTS company_recent_news jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS company_challenges jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS company_role_context text,
  ADD COLUMN IF NOT EXISTS company_researched_at timestamptz;

-- Index for finding opportunities that need research
CREATE INDEX IF NOT EXISTS idx_opportunities_company_researched_at
  ON opportunities (company_researched_at)
  WHERE company_researched_at IS NULL;

COMMENT ON COLUMN opportunities.company_url IS 'Company website URL discovered via research';
COMMENT ON COLUMN opportunities.company_is_public IS 'Whether the company is publicly traded';
COMMENT ON COLUMN opportunities.company_stock_ticker IS 'Stock ticker symbol if publicly traded';
COMMENT ON COLUMN opportunities.company_industry IS 'Industry classification (e.g., Healthcare Tech, SaaS)';
COMMENT ON COLUMN opportunities.company_recent_news IS 'Array of recent news summaries about the company';
COMMENT ON COLUMN opportunities.company_challenges IS 'Array of likely business/technical challenges this hire might address';
COMMENT ON COLUMN opportunities.company_role_context IS 'Why the company is likely hiring for this role now';
COMMENT ON COLUMN opportunities.company_researched_at IS 'When company research was last performed';
