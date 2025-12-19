-- Add optional contact fields to profiles table
-- These fields are extracted from resumes and are all nullable/defensive

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS linkedin text,
  ADD COLUMN IF NOT EXISTS github text,
  ADD COLUMN IF NOT EXISTS website text;

COMMENT ON COLUMN public.profiles.phone IS 'Phone number extracted from resume';
COMMENT ON COLUMN public.profiles.location IS 'Location (city, state) extracted from resume';
COMMENT ON COLUMN public.profiles.linkedin IS 'LinkedIn profile URL extracted from resume';
COMMENT ON COLUMN public.profiles.github IS 'GitHub profile URL extracted from resume';
COMMENT ON COLUMN public.profiles.website IS 'Personal website URL extracted from resume';
