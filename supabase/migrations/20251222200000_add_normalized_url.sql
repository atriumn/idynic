-- Add normalized_url column for duplicate detection
ALTER TABLE opportunities
ADD COLUMN normalized_url text;

-- Index for fast duplicate lookups by user
CREATE INDEX idx_opportunities_normalized_url
ON opportunities(user_id, normalized_url);

-- Backfill existing opportunities with normalized URLs
UPDATE opportunities
SET normalized_url = CASE
  -- LinkedIn: extract job ID
  WHEN url LIKE '%linkedin.com/jobs/view/%' THEN
    'linkedin:' || regexp_replace(url, '.*linkedin\.com/jobs/view/(\d+).*', '\1')
  -- Greenhouse
  WHEN url LIKE '%greenhouse.io%' THEN
    'greenhouse:' || regexp_replace(url, '.*boards\.greenhouse\.io/([^/]+)/jobs/(\d+).*', '\1:\2')
  -- Lever
  WHEN url LIKE '%lever.co%' THEN
    'lever:' || regexp_replace(url, '.*jobs\.lever\.co/([^/]+)/([a-f0-9-]+).*', '\1:\2')
  -- Other URLs: hostname + path (strip query params)
  WHEN url IS NOT NULL THEN
    regexp_replace(url, '^https?://([^?]+).*', '\1')
  ELSE NULL
END
WHERE url IS NOT NULL;
