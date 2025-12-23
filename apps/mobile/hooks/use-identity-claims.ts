import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

export interface Evidence {
  id: string;
  text: string;
  evidence_type: string;
  source_type: string | null;
  evidence_date: string | null;
}

export interface IdentityClaim {
  id: string;
  type: 'skill' | 'achievement' | 'attribute' | 'education' | 'certification';
  label: string;
  description: string | null;
  confidence: number | null;
  evidence: Evidence[];
}

export interface GroupedClaims {
  skill: IdentityClaim[];
  achievement: IdentityClaim[];
  attribute: IdentityClaim[];
  education: IdentityClaim[];
  certification: IdentityClaim[];
}

export const CLAIM_TYPE_COLORS: Record<string, {
  bg: string;
  text: string;
  border: string;
  icon: string;
  bgHex: string;
  textHex: string;
  borderHex: string;
}> = {
  skill: { bg: 'bg-blue-900/50', text: 'text-blue-300', border: 'border-blue-700', icon: '#93c5fd', bgHex: '#1e3a5f', textHex: '#93c5fd', borderHex: '#1d4ed8' },
  achievement: { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700', icon: '#86efac', bgHex: '#14532d', textHex: '#86efac', borderHex: '#15803d' },
  attribute: { bg: 'bg-purple-900/50', text: 'text-purple-300', border: 'border-purple-700', icon: '#d8b4fe', bgHex: '#3b0764', textHex: '#d8b4fe', borderHex: '#7e22ce' },
  education: { bg: 'bg-amber-900/50', text: 'text-amber-300', border: 'border-amber-700', icon: '#fcd34d', bgHex: '#78350f', textHex: '#fcd34d', borderHex: '#b45309' },
  certification: { bg: 'bg-teal-900/50', text: 'text-teal-300', border: 'border-teal-700', icon: '#5eead4', bgHex: '#134e4a', textHex: '#5eead4', borderHex: '#0f766e' },
};

export const CLAIM_TYPE_LABELS: Record<string, string> = {
  skill: 'Skills',
  achievement: 'Achievements',
  attribute: 'Attributes',
  education: 'Education',
  certification: 'Certifications',
};

async function fetchIdentityClaims(userId: string): Promise<GroupedClaims> {
  // Fetch claims with their evidence through the junction table
  const { data: claims, error } = await supabase
    .from('identity_claims')
    .select(`
      id,
      type,
      label,
      description,
      confidence,
      claim_evidence (
        evidence (
          id,
          text,
          evidence_type,
          source_type,
          evidence_date
        )
      )
    `)
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  if (error) throw error;

  // Transform and group by type
  const grouped: GroupedClaims = {
    skill: [],
    achievement: [],
    attribute: [],
    education: [],
    certification: [],
  };

  for (const claim of claims || []) {
    const type = claim.type as keyof GroupedClaims;
    if (!grouped[type]) continue;

    // Extract evidence from nested structure
    const evidence: Evidence[] = [];
    if (Array.isArray(claim.claim_evidence)) {
      for (const ce of claim.claim_evidence) {
        if (ce.evidence) {
          evidence.push(ce.evidence as Evidence);
        }
      }
    }

    grouped[type].push({
      id: claim.id,
      type: claim.type as IdentityClaim['type'],
      label: claim.label,
      description: claim.description,
      confidence: claim.confidence,
      evidence,
    });
  }

  return grouped;
}

export function useIdentityClaims() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['identity-claims', session?.user?.id],
    queryFn: () => {
      if (!session?.user?.id) {
        throw new Error('Not authenticated');
      }
      return fetchIdentityClaims(session.user.id);
    },
    enabled: !!session?.user?.id,
  });
}

// Helper to check if user has any claims
export function hasAnyClaims(grouped: GroupedClaims | undefined): boolean {
  if (!grouped) return false;
  return Object.values(grouped).some((claims) => claims.length > 0);
}

// Helper to get total claim count
export function getTotalClaimCount(grouped: GroupedClaims | undefined): number {
  if (!grouped) return 0;
  return Object.values(grouped).reduce((sum, claims) => sum + claims.length, 0);
}
