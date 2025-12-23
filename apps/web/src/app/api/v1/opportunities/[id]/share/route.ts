import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { randomBytes } from 'crypto';

function generateToken(): string {
  return randomBytes(16).toString('hex');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: opportunityId } = await params;
  const supabase = createServiceRoleClient();

  // Parse optional expiration
  let expiresInDays = 30;
  try {
    const body = await request.json();
    if (typeof body.expires_in_days === 'number') {
      expiresInDays = body.expires_in_days;
    }
  } catch {
    // No body is fine
  }

  // Get tailored profile for this opportunity
  const { data: profile, error: profileError } = await supabase
    .from('tailored_profiles')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    return apiError('validation_error', 'No tailored profile exists for this opportunity. Generate one first with POST /opportunities/:id/tailor', 400);
  }

  // Check for existing link
  const { data: existingLink } = await supabase
    .from('shared_links')
    .select('id, token, expires_at')
    .eq('tailored_profile_id', profile.id)
    .is('revoked_at', null)
    .single();

  if (existingLink) {
    // Return existing link
    return apiSuccess({
      id: existingLink.id,
      token: existingLink.token,
      url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${existingLink.token}`,
      expires_at: existingLink.expires_at,
      existing: true,
    });
  }

  // Calculate expiration
  const expiresAt = new Date();
  if (expiresInDays > 0) {
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 10);
  }

  const token = generateToken();
  const { data: newLink, error } = await supabase
    .from('shared_links')
    .insert({
      tailored_profile_id: profile.id,
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create shared link:', error);
    return apiError('server_error', 'Failed to create share link', 500);
  }

  return apiSuccess({
    id: newLink.id,
    token: newLink.token,
    url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${token}`,
    expires_at: newLink.expires_at,
    existing: false,
  });
}
