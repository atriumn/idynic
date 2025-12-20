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
  const status = searchParams.get('status'); // Filter by status

  // Build query
  let query = supabase
    .from('opportunities')
    .select(`
      id,
      title,
      company,
      url,
      description,
      requirements,
      status,
      created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data: opportunities, error } = await query;

  if (error) {
    console.error('Error fetching opportunities:', error);
    return apiSuccess([], { count: 0, has_more: false });
  }

  // TODO: Add match scores once matching logic is integrated
  // For now, return opportunities without scores

  return apiSuccess(
    opportunities?.map(o => ({
      ...o,
      match_score: null, // Placeholder for future match scoring
    })) || [],
    {
      count: opportunities?.length || 0,
      has_more: false,
    }
  );
}
