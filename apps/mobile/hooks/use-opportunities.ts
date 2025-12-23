import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

export interface Opportunity {
  id: string;
  title: string | null;
  company: string | null;
  company_logo_url: string | null;
  location: string | null;
  employment_type: string | null;
  status: string | null;
  requirements: unknown;
  created_at: string | null;
}

// Helper to safely extract requirements
export function getRequirements(requirements: unknown): { mustHave?: string[]; niceToHave?: string[] } | null {
  if (!requirements || typeof requirements !== 'object') return null;
  const req = requirements as Record<string, unknown>;
  return {
    mustHave: Array.isArray(req.mustHave) ? req.mustHave : undefined,
    niceToHave: Array.isArray(req.niceToHave) ? req.niceToHave : undefined,
  };
}

async function fetchOpportunities(userId: string): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, title, company, company_logo_url, location, employment_type, status, requirements, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export function useOpportunities() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['opportunities', session?.user?.id],
    queryFn: () => {
      if (!session?.user?.id) {
        throw new Error('Not authenticated');
      }
      return fetchOpportunities(session.user.id);
    },
    enabled: !!session?.user?.id,
  });
}
