import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { hashApiKey, isValidApiKeyFormat } from './keys';
import { checkRateLimit, API_RATE_LIMITS } from './rate-limit';
import { apiError } from './response';

export interface ApiAuthResult {
  userId: string;
  keyId: string | null; // null for JWT auth
  authType: 'api_key' | 'jwt';
}

export interface ApiAuthError {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

/**
 * Create a rate limit error response.
 */
export function rateLimitResponse(resetAt: number): NextResponse<ApiAuthError> {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return apiError('rate_limited', 'Too many requests', 429, {
    'Retry-After': String(retryAfter),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  });
}

/**
 * Validate a Supabase JWT token.
 * Returns user info if valid, null if invalid.
 */
async function validateJwtToken(
  token: string,
  requestId: string
): Promise<ApiAuthResult | NextResponse<ApiAuthError>> {
  // Create a Supabase client with the user's JWT to validate it
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_token',
          message: 'Invalid or expired JWT token',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  // Check rate limit for JWT users
  const rateLimit = checkRateLimit(`jwt:${user.id}`, API_RATE_LIMITS.api);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  return {
    userId: user.id,
    keyId: null,
    authType: 'jwt',
  };
}

/**
 * Validate API key or JWT from Authorization header.
 * Supports both:
 * - API keys (format: idn_xxx) for external clients
 * - Supabase JWT tokens for mobile/web apps
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
          code: 'unauthorized',
          message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7); // Remove 'Bearer '

  // Route to appropriate validator based on token format
  // API keys start with "idn_", JWTs are base64-encoded (start with "eyJ")
  if (isValidApiKeyFormat(token)) {
    return validateApiKeyToken(token, requestId);
  } else {
    // Assume it's a JWT token
    return validateJwtToken(token, requestId);
  }
}

/**
 * Validate an API key token.
 */
async function validateApiKeyToken(
  key: string,
  requestId: string
): Promise<ApiAuthResult | NextResponse<ApiAuthError>> {
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

  // Check rate limit
  const rateLimit = checkRateLimit(`api:${apiKey.user_id}`, API_RATE_LIMITS.api);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  return {
    userId: apiKey.user_id,
    keyId: apiKey.id,
    authType: 'api_key',
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
