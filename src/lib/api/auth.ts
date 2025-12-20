import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { hashApiKey, isValidApiKeyFormat } from './keys';

export interface ApiAuthResult {
  userId: string;
  keyId: string;
}

export interface ApiAuthError {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

/**
 * Validate API key from Authorization header.
 * Returns user info if valid, error response if not.
 */
export async function validateApiKey(
  request: NextRequest
): Promise<ApiAuthResult | NextResponse<ApiAuthError>> {
  const requestId = crypto.randomUUID().slice(0, 8);

  // Extract Bearer token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_api_key',
          message: 'Missing or malformed Authorization header. Expected: Bearer idn_xxx',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  const key = authHeader.slice(7); // Remove 'Bearer '

  // Validate format
  if (!isValidApiKeyFormat(key)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_api_key',
          message: 'Invalid API key format',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  // Look up key in database using service role (bypasses RLS)
  const keyHash = hashApiKey(key);
  const supabase = createServiceRoleClient();

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select('id, user_id, expires_at, revoked_at')
    .eq('key_hash', keyHash)
    .single();

  if (error || !apiKey) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_api_key',
          message: 'API key not found or invalid',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  // Check if revoked
  if (apiKey.revoked_at) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_api_key',
          message: 'API key has been revoked',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  // Check if expired
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return NextResponse.json(
      {
        error: {
          code: 'expired_api_key',
          message: 'API key has expired',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  // Update last_used_at (fire and forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {});

  return {
    userId: apiKey.user_id,
    keyId: apiKey.id,
  };
}

/**
 * Check if result is an error response.
 */
export function isAuthError(
  result: ApiAuthResult | NextResponse<ApiAuthError>
): result is NextResponse<ApiAuthError> {
  return result instanceof NextResponse;
}
