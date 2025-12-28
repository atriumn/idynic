import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors, apiError } from '@/lib/api/response';
import { generateProfileWithClient } from '@/lib/ai/generate-profile-api';
import { checkTailoredProfileLimit, incrementTailoredProfileCount } from '@/lib/billing/check-usage';
import { evaluateTailoredProfile, getUserClaimsForEval } from '@/lib/ai/eval';
import type { TablesInsert, Json } from '@/lib/supabase/types';

export async function POST(
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

  // Parse optional regenerate flag
  let regenerate = false;
  try {
    const body = await request.json();
    regenerate = body.regenerate === true;
  } catch {
    // No body or invalid JSON is fine
  }

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

  // Check if a cached profile already exists
  const { data: existingProfile } = await supabase
    .from('tailored_profiles')
    .select('id')
    .eq('opportunity_id', id)
    .eq('user_id', userId)
    .single();

  const hasCachedProfile = !!existingProfile;

  // Check tailored profile limit if we might need to generate a new one
  // Allow if: cached profile exists and not forcing regenerate
  if (!hasCachedProfile || regenerate) {
    const usageCheck = await checkTailoredProfileLimit(supabase, userId);
    if (!usageCheck.allowed) {
      return apiError(
        'limit_reached',
        usageCheck.reason || 'Tailored profile limit reached',
        403,
      );
    }
  }

  try {
    const result = await generateProfileWithClient(supabase, id, userId, regenerate);

    // If we generated a new profile (not cached), increment the count and run eval
    let evalResult = null;
    if (!result.cached) {
      await incrementTailoredProfileCount(supabase, userId);

      // Run tailoring evaluation
      try {
        const userClaims = await getUserClaimsForEval(supabase, userId);
        const evaluation = await evaluateTailoredProfile({
          tailoredProfileId: result.profile.id,
          userId,
          narrative: result.profile.narrative,
          resumeData: result.profile.resume_data,
          userClaims,
        });

        // Store eval result in tailoring_eval_log
        const evalLogEntry: TablesInsert<'tailoring_eval_log'> = {
          tailored_profile_id: result.profile.id,
          user_id: userId,
          passed: evaluation.passed,
          grounding_passed: evaluation.grounding.passed,
          hallucinations: evaluation.grounding.hallucinations as unknown as Json,
          missed_opportunities: evaluation.utilization.missed as unknown as Json,
          gaps: evaluation.gaps as unknown as Json,
          eval_model: evaluation.model,
          eval_cost_cents: evaluation.costCents,
        };
        await supabase.from('tailoring_eval_log').insert(evalLogEntry);

        evalResult = {
          passed: evaluation.passed,
          hallucinations: evaluation.grounding.hallucinations,
          missedOpportunities: evaluation.utilization.missed,
          gaps: evaluation.gaps,
        };
      } catch (evalErr) {
        console.error('Tailoring eval error:', evalErr);
        // Continue without eval - don't fail the request
      }
    }

    return apiSuccess({
      id: result.profile.id,
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        company: opportunity.company,
      },
      narrative: result.profile.narrative,
      resume_data: result.profile.resume_data,
      cached: result.cached,
      created_at: result.profile.created_at,
      evaluation: evalResult,
    });
  } catch (err) {
    console.error('Profile generation error:', err);
    return apiError('processing_failed', 'Failed to generate tailored profile', 500);
  }
}
