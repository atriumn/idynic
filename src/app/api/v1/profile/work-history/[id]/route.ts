import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response';

interface WorkHistoryUpdateBody {
  company?: string;
  title?: string;
  start_date?: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  company_domain?: string | null;
}

export async function PATCH(
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

  try {
    const body: WorkHistoryUpdateBody = await request.json();

    if (Object.keys(body).length === 0) {
      return apiError('validation_error', 'No fields to update', 400);
    }

    const { data, error } = await supabase
      .from('work_history')
      .update(body)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update work history:', error);
      return apiError('server_error', 'Failed to update entry', 500);
    }

    if (!data) {
      return ApiErrors.notFound('Work history entry');
    }

    return apiSuccess(data);
  } catch (err) {
    console.error('Work history update error:', err);
    return apiError('server_error', 'Failed to process request', 500);
  }
}

export async function DELETE(
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

  const { error } = await supabase
    .from('work_history')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to delete work history:', error);
    return apiError('server_error', 'Failed to delete entry', 500);
  }

  return apiSuccess({ deleted: true });
}
