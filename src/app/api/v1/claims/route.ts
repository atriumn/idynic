import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = await createClient();

  // Parse query params
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // Filter by type (skill, achievement, attribute, education, certification)

  // Build query
  let query = supabase
    .from('identity_claims')
    .select(`
      id,
      type,
      label,
      description,
      confidence,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data: claims, error } = await query;

  if (error) {
    console.error('Error fetching claims:', error);
    return apiSuccess([], { count: 0, has_more: false });
  }

  return apiSuccess(claims || [], {
    count: claims?.length || 0,
    has_more: false,
  });
}
