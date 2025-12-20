import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return ApiErrors.notFound('Profile');
  }

  // Fetch work history
  const { data: workHistory } = await supabase
    .from('work_history')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });

  // Fetch identity claims (for skills, education, certifications)
  const { data: claims } = await supabase
    .from('identity_claims')
    .select('*')
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  // Separate claims by type
  const skills = claims?.filter(c => c.type === 'skill') || [];
  const education = claims?.filter(c => c.type === 'education') || [];
  const certifications = claims?.filter(c => c.type === 'certification') || [];

  // Note: work_history table doesn't have entry_type field yet
  // For now, return all work history in experience array
  const experience = workHistory || [];

  return apiSuccess({
    contact: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedin_url: profile.linkedin,
      github_url: profile.github,
      website_url: profile.website,
      logo_url: profile.logo_url,
    },
    experience,
    ventures: [],
    additional_experience: [],
    skills: skills.map(s => ({
      id: s.id,
      label: s.label,
      description: s.description,
      confidence: s.confidence,
    })),
    education: education.map(e => ({
      id: e.id,
      label: e.label,
      description: e.description,
      confidence: e.confidence,
    })),
    certifications: certifications.map(c => ({
      id: c.id,
      label: c.label,
      description: c.description,
      confidence: c.confidence,
    })),
  });
}
