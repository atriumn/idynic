import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors } from '@/lib/api/response';

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

  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !opportunity) {
    return ApiErrors.notFound('Opportunity');
  }

  return apiSuccess({
    id: opportunity.id,
    title: opportunity.title,
    company: opportunity.company,
    url: opportunity.url,
    description: opportunity.description,
    requirements: opportunity.requirements,
    status: opportunity.status,
    created_at: opportunity.created_at,
  });
}
