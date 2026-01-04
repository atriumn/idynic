-- Unified waitlist table
-- Replaces recruiter_waitlist and beta_waitlist with a single table
-- that tracks interests (job_seeking, recruiting) and signup source

-- Create the unified waitlist table
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  interests TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT waitlist_email_unique UNIQUE (email),
  CONSTRAINT waitlist_source_check CHECK (source IN ('homepage', 'students', 'recruiters', 'mobile')),
  CONSTRAINT waitlist_interests_check CHECK (
    interests <@ ARRAY['job_seeking', 'recruiting']::text[]
  )
);

-- Indexes for common queries
CREATE INDEX idx_waitlist_email ON public.waitlist(email);
CREATE INDEX idx_waitlist_source ON public.waitlist(source);
CREATE INDEX idx_waitlist_created_at ON public.waitlist(created_at);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public waitlist signup)
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist FOR INSERT
  WITH CHECK (true);

-- Function to upsert waitlist entry with interest merging
-- If email exists: merges new interests with existing, updates updated_at
-- If email is new: inserts with provided source and interests
CREATE OR REPLACE FUNCTION public.upsert_waitlist(
  p_email TEXT,
  p_source TEXT,
  p_interests TEXT[]
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.waitlist (email, source, interests)
  VALUES (p_email, p_source, p_interests)
  ON CONFLICT (email) DO UPDATE SET
    interests = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(array_cat(public.waitlist.interests, p_interests))
      )
    ),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Migrate data from recruiter_waitlist
-- Source: 'recruiters', Interest: 'recruiting'
-- Use DISTINCT ON to handle any duplicate emails (take earliest)
INSERT INTO public.waitlist (email, interests, source, created_at)
SELECT DISTINCT ON (LOWER(TRIM(email)))
  LOWER(TRIM(email)),
  ARRAY['recruiting']::text[],
  'recruiters',
  created_at
FROM public.recruiter_waitlist
ORDER BY LOWER(TRIM(email)), created_at ASC;

-- Migrate data from beta_waitlist
-- Source: 'mobile', Interest: 'job_seeking'
-- Use ON CONFLICT to merge interests if email already exists from recruiter_waitlist
INSERT INTO public.waitlist (email, interests, source, created_at)
SELECT
  LOWER(TRIM(email)),
  ARRAY['job_seeking']::text[],
  'mobile',
  created_at
FROM public.beta_waitlist
ON CONFLICT (email) DO UPDATE SET
  interests = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(array_cat(public.waitlist.interests, ARRAY['job_seeking']::text[]))
    )
  ),
  updated_at = now();

-- Drop the old tables
DROP TABLE public.recruiter_waitlist;
DROP TABLE public.beta_waitlist;
