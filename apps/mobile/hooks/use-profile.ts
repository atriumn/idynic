import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

interface WorkHistoryItem {
  id: string;
  company: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  summary: string | null;
}

interface Skill {
  id: string;
  label: string;
  description: string | null;
  confidence: number | null;
}

interface Education {
  id: string;
  text: string;
  context: unknown;
}

export interface IdentityReflection {
  archetype: string | null;
  headline: string | null;
  bio: string | null;
  keywords: string[];
  matches: string[];
  generated_at: string | null;
}

export interface Profile {
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
    logo_url: string | null;
  };
  identity: IdentityReflection | null;
  workHistory: WorkHistoryItem[];
  ventures: WorkHistoryItem[];
  skills: Skill[];
  education: Education[];
}

async function fetchProfile(userId: string): Promise<Profile> {
  // Fetch profile data in parallel (matching web app's /api/profile)
  const [
    { data: profile, error: profileError },
    { data: workHistory },
    { data: ventures },
    { data: skills },
    { data: education },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, email, phone, location, linkedin, github, website, logo_url, identity_headline, identity_bio, identity_archetype, identity_keywords, identity_matches, identity_generated_at')
      .eq('id', userId)
      .single(),

    // Work history (excluding ventures)
    supabase
      .from('work_history')
      .select('id, company, title, start_date, end_date, location, summary')
      .eq('user_id', userId)
      .or('entry_type.is.null,entry_type.in.(work,additional)')
      .order('order_index', { ascending: true }),

    // Ventures only
    supabase
      .from('work_history')
      .select('id, company, title, start_date, end_date, location, summary')
      .eq('user_id', userId)
      .eq('entry_type', 'venture')
      .order('order_index', { ascending: true }),

    // Skills from identity_claims
    supabase
      .from('identity_claims')
      .select('id, label, description, confidence')
      .eq('user_id', userId)
      .eq('type', 'skill')
      .order('confidence', { ascending: false }),

    // Education from evidence
    supabase
      .from('evidence')
      .select('id, text, context')
      .eq('user_id', userId)
      .eq('evidence_type', 'education')
      .order('created_at', { ascending: false }),
  ]);

  if (profileError) throw profileError;

  // Build identity reflection object (only if generated)
  const identity: IdentityReflection | null = profile?.identity_generated_at ? {
    archetype: profile.identity_archetype ?? null,
    headline: profile.identity_headline ?? null,
    bio: profile.identity_bio ?? null,
    keywords: (profile.identity_keywords as string[]) ?? [],
    matches: (profile.identity_matches as string[]) ?? [],
    generated_at: profile.identity_generated_at,
  } : null;

  return {
    contact: profile || {
      name: null,
      email: null,
      phone: null,
      location: null,
      linkedin: null,
      github: null,
      website: null,
      logo_url: null,
    },
    identity,
    workHistory: workHistory || [],
    ventures: ventures || [],
    skills: skills || [],
    education: education || [],
  };
}

export function useProfile() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: () => {
      if (!session?.user?.id) {
        throw new Error('Not authenticated');
      }
      return fetchProfile(session.user.id);
    },
    enabled: !!session?.user?.id,
  });
}
