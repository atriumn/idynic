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
      .select('name, email, phone, location, linkedin, github, website, logo_url')
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
