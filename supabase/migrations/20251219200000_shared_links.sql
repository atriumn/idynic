-- Create shared_links table
CREATE TABLE public.shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tailored_profile_id UUID NOT NULL REFERENCES public.tailored_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token VARCHAR(32) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One link per tailored profile
  CONSTRAINT unique_tailored_profile_link UNIQUE (tailored_profile_id)
);

-- Create shared_link_views table
CREATE TABLE public.shared_link_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_link_id UUID NOT NULL REFERENCES public.shared_links(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recruiter_waitlist table
CREATE TABLE public.recruiter_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_shared_links_token ON public.shared_links(token);
CREATE INDEX idx_shared_links_user_id ON public.shared_links(user_id);
CREATE INDEX idx_shared_link_views_shared_link_id ON public.shared_link_views(shared_link_id);

-- RLS for shared_links
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- Users can manage their own links
CREATE POLICY "Users can view own shared_links"
  ON public.shared_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shared_links"
  ON public.shared_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared_links"
  ON public.shared_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared_links"
  ON public.shared_links FOR DELETE
  USING (auth.uid() = user_id);

-- Public can read by token (for share page) - non-revoked, non-expired only
CREATE POLICY "Public can read active links by token"
  ON public.shared_links FOR SELECT
  USING (
    revoked_at IS NULL
    AND expires_at > now()
  );

-- RLS for shared_link_views
ALTER TABLE public.shared_link_views ENABLE ROW LEVEL SECURITY;

-- Users can view views for their links
CREATE POLICY "Users can view own link views"
  ON public.shared_link_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_links sl
      WHERE sl.id = shared_link_id AND sl.user_id = auth.uid()
    )
  );

-- Public can insert views (for tracking)
CREATE POLICY "Anyone can insert views"
  ON public.shared_link_views FOR INSERT
  WITH CHECK (true);

-- RLS for recruiter_waitlist
ALTER TABLE public.recruiter_waitlist ENABLE ROW LEVEL SECURITY;

-- Public can insert (no read access)
CREATE POLICY "Anyone can join waitlist"
  ON public.recruiter_waitlist FOR INSERT
  WITH CHECK (true);
