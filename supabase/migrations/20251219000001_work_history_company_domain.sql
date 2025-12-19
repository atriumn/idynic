-- Add company_domain column to work_history table for logo lookups

ALTER TABLE public.work_history
  ADD COLUMN IF NOT EXISTS company_domain text;

COMMENT ON COLUMN public.work_history.company_domain IS 'Company domain for logo lookup (e.g., google.com)';
