import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors } from '@/lib/api/response';
import { computeOpportunityMatchesWithClient } from '@/lib/ai/match-opportunity-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Verify opportunity exists and belongs to user
  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('id, title, company')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !opportunity) {
    return ApiErrors.notFound('Opportunity');
  }

  // Compute matches
  const matchResult = await computeOpportunityMatchesWithClient(supabase, id, userId);

  return apiSuccess({
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      company: opportunity.company,
    },
    scores: {
      overall: matchResult.overallScore,
      must_have: matchResult.mustHaveScore,
      nice_to_have: matchResult.niceToHaveScore,
    },
    strengths: matchResult.strengths.slice(0, 5).map(s => ({
      requirement: s.requirement.text,
      match: s.bestMatch ? {
        claim: s.bestMatch.label,
        type: s.bestMatch.type,
        similarity: Math.round(s.bestMatch.similarity * 100),
      } : null,
    })),
    gaps: matchResult.gaps.map(g => ({
      requirement: g.text,
      type: g.type,
      category: g.category,
    })),
  });
}
