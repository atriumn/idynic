import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  const { data: workHistory, error } = await supabase
    .from('work_history')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching work history:', error);
    return apiSuccess([], { count: 0, has_more: false });
  }

  return apiSuccess(workHistory || [], {
    count: workHistory?.length || 0,
    has_more: false,
  });
}
