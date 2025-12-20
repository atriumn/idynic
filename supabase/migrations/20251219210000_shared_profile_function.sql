-- Function to fetch shared profile data with proper security
-- SECURITY DEFINER runs with the privileges of the function owner (postgres)
-- This creates a controlled "hole" in RLS that only exposes what's needed

CREATE OR REPLACE FUNCTION public.get_shared_profile(p_token VARCHAR(32))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_result JSON;
BEGIN
  -- Fetch the shared link with all necessary data
  SELECT 
    sl.id,
    sl.expires_at,
    sl.revoked_at,
    tp.narrative,
    tp.resume_data,
    o.title AS opportunity_title,
    o.company AS opportunity_company,
    p.name AS candidate_name,
    p.email AS candidate_email,
    p.phone AS candidate_phone,
    p.location AS candidate_location,
    p.linkedin AS candidate_linkedin,
    p.github AS candidate_github,
    p.website AS candidate_website,
    p.logo_url AS candidate_logo_url
  INTO v_link
  FROM shared_links sl
  JOIN tailored_profiles tp ON tp.id = sl.tailored_profile_id
  JOIN opportunities o ON o.id = tp.opportunity_id
  JOIN profiles p ON p.id = sl.user_id
  WHERE sl.token = p_token;

  -- Token not found
  IF v_link IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  -- Check if revoked
  IF v_link.revoked_at IS NOT NULL THEN
    RETURN json_build_object(
      'error', 'revoked',
      'candidate_name', v_link.candidate_name
    );
  END IF;

  -- Check if expired
  IF v_link.expires_at < NOW() THEN
    RETURN json_build_object(
      'error', 'expired',
      'candidate_name', v_link.candidate_name
    );
  END IF;

  -- Log the view (this will respect RLS since we're inserting)
  INSERT INTO shared_link_views (shared_link_id) VALUES (v_link.id);

  -- Return the profile data
  RETURN json_build_object(
    'candidate', json_build_object(
      'name', v_link.candidate_name,
      'email', v_link.candidate_email,
      'phone', v_link.candidate_phone,
      'location', v_link.candidate_location,
      'linkedin', v_link.candidate_linkedin,
      'github', v_link.candidate_github,
      'website', v_link.candidate_website,
      'logoUrl', v_link.candidate_logo_url
    ),
    'opportunity', json_build_object(
      'title', v_link.opportunity_title,
      'company', v_link.opportunity_company
    ),
    'narrative', v_link.narrative,
    'resumeData', v_link.resume_data
  );
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_shared_profile(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shared_profile(VARCHAR) TO authenticated;

COMMENT ON FUNCTION public.get_shared_profile IS 
'Securely fetches shared profile data by token. Uses SECURITY DEFINER to bypass RLS 
in a controlled way, returning only the specific fields needed for public display.';
