import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';

export interface OpportunityDetail {
  id: string;
  title: string | null;
  company: string | null;
  company_logo_url: string | null;
  company_url: string | null;
  url: string | null;
  location: string | null;
  employment_type: string | null;
  status: string | null;
  description: string | null;
  description_html: string | null;
  requirements: unknown;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  company_role_context: string | null;
  company_recent_news: unknown;
  company_challenges: unknown;
  created_at: string | null;
}

export interface ResumeExperience {
  company: string;
  companyDomain?: string | null;
  title: string;
  dates: string;
  location: string | null;
  bullets: string[];
}

export interface ResumeVenture {
  name: string;
  role: string;
  status: string | null;
  description: string | null;
}

export interface ResumeEducation {
  institution: string;
  degree: string;
  year: string | null;
}

export interface SkillCategory {
  category: string;
  skills: string[];
}

export interface ResumeData {
  summary: string;
  skills: SkillCategory[] | string[];
  experience: ResumeExperience[];
  additionalExperience?: ResumeExperience[];
  ventures?: ResumeVenture[];
  education: ResumeEducation[];
}

export interface TailoredProfile {
  id: string;
  narrative: string | null;
  resume_data: ResumeData | null;
  created_at: string | null;
}

async function fetchOpportunity(userId: string, opportunityId: string): Promise<OpportunityDetail | null> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export function useOpportunity(opportunityId: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['opportunity', opportunityId, session?.user?.id],
    queryFn: () => {
      if (!session?.user?.id) {
        throw new Error('Not authenticated');
      }
      return fetchOpportunity(session.user.id, opportunityId);
    },
    enabled: !!session?.user?.id && !!opportunityId,
  });
}

async function fetchTailoredProfile(userId: string, opportunityId: string): Promise<TailoredProfile | null> {
  const { data, error } = await supabase
    .from('tailored_profiles')
    .select('id, narrative, resume_data, created_at')
    .eq('opportunity_id', opportunityId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

export function useTailoredProfile(opportunityId: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['tailored-profile', opportunityId, session?.user?.id],
    queryFn: () => {
      if (!session?.user?.id) {
        throw new Error('Not authenticated');
      }
      return fetchTailoredProfile(session.user.id, opportunityId);
    },
    enabled: !!session?.user?.id && !!opportunityId,
  });
}

export interface GeneratedProfile {
  id: string;
  opportunity: {
    id: string;
    title: string | null;
    company: string | null;
  };
  narrative: string | null;
  resume_data: unknown;
  cached: boolean;
  created_at: string;
}

export function useGenerateTailoredProfile(opportunityId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options?: { regenerate?: boolean }): Promise<GeneratedProfile> => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      const response = await api.opportunities.tailor(opportunityId);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate the tailored profile query to refetch
      queryClient.invalidateQueries({
        queryKey: ['tailored-profile', opportunityId, session?.user?.id]
      });
    },
  });
}
