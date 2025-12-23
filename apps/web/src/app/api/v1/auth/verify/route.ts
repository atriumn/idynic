import { NextRequest } from 'next/server';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess } from '@/lib/api/response';

/**
 * GET /api/v1/auth/verify
 *
 * Verify that an API key is valid.
 * Used by the Chrome extension to test connection.
 */
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);

  if (isAuthError(authResult)) {
    return authResult;
  }

  return apiSuccess({
    valid: true,
    user_id: authResult.userId,
  });
}
