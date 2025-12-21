-- Backfill evidence_date from context.dates field
-- Parse patterns like "2020-2023", "2021-Present", "2020", "Jan 2020 - Dec 2023"
-- Use the END date (most recent) for recency calculations

-- Pattern 1: "YYYY-YYYY" or "YYYY - YYYY" -> extract second year
UPDATE evidence
SET evidence_date = make_date(
  (regexp_match(context->>'dates', '(\d{4})\s*$'))[1]::int,
  6, -- Default to mid-year (June)
  1
)
WHERE context->>'dates' ~ '\d{4}\s*$'
  AND evidence_date IS NULL;

-- Pattern 2: "Present" or "Current" -> use today
UPDATE evidence
SET evidence_date = CURRENT_DATE
WHERE (context->>'dates' ~* 'present|current')
  AND evidence_date IS NULL;

-- Pattern 3: Just a year "2020" with no end date
UPDATE evidence
SET evidence_date = make_date(
  (regexp_match(context->>'dates', '^(\d{4})'))[1]::int,
  6,
  1
)
WHERE context->>'dates' ~ '^\d{4}'
  AND evidence_date IS NULL;

-- For education/certifications, try context.year
UPDATE evidence
SET evidence_date = make_date(
  (context->>'year')::int,
  6,
  1
)
WHERE context->>'year' IS NOT NULL
  AND (context->>'year') ~ '^\d{4}$'
  AND evidence_date IS NULL;

-- Log how many remain unset (will use created_at as fallback in code)
DO $$
DECLARE
  unset_count int;
BEGIN
  SELECT COUNT(*) INTO unset_count FROM evidence WHERE evidence_date IS NULL;
  RAISE NOTICE 'Evidence items without dates: %', unset_count;
END $$;
