import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockSupabaseClient } from '@/__mocks__/supabase'

// Mock the service role client
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn()
}))

// Mock Supabase client for JWT validation
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } })
    }
  }))
}))

describe('api/auth', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(async () => {
    vi.resetModules()
    mockSupabase = createMockSupabaseClient()

    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    vi.mocked(createServiceRoleClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServiceRoleClient>)
  })

  const createRequest = (headers: Record<string, string> = {}) => {
    return new NextRequest('http://localhost/api/v1/test', {
      headers: new Headers(headers)
    })
  }

  describe('validateApiKey', () => {
    it('returns error for missing Authorization header', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      const request = createRequest()

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(401)
        const body = await result.json()
        expect(body.error.code).toBe('unauthorized')
        expect(body.error.message).toContain('Missing')
      }
    })

    it('returns error for non-Bearer auth', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      const request = createRequest({ 'Authorization': 'Basic abc123' })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(401)
      }
    })

    it('returns error for invalid token (non-API-key tokens go through JWT validation)', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      const request = createRequest({ 'Authorization': 'Bearer not_valid_format' })

      const result = await validateApiKey(request)

      // Non-API-key tokens are treated as JWTs and validated accordingly
      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(401)
        const body = await result.json()
        expect(body.error.code).toBe('invalid_token')
      }
    })

    it('returns error when key not found in database', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      mockSupabase.__setMockError(new Error('Not found'))

      const validKey = 'idn_' + 'a'.repeat(64)
      const request = createRequest({ 'Authorization': `Bearer ${validKey}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(401)
        const body = await result.json()
        expect(body.error.message).toContain('not found')
      }
    })

    it('returns error for revoked key', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      mockSupabase.__setMockData({
        id: 'key-1',
        user_id: 'user-1',
        revoked_at: new Date().toISOString(),
        expires_at: null
      })

      const validKey = 'idn_' + 'a'.repeat(64)
      const request = createRequest({ 'Authorization': `Bearer ${validKey}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(401)
        const body = await result.json()
        expect(body.error.message).toContain('revoked')
      }
    })

    it('returns error for expired key', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      mockSupabase.__setMockData({
        id: 'key-1',
        user_id: 'user-1',
        revoked_at: null,
        expires_at: new Date(Date.now() - 86400000).toISOString() // Expired yesterday
      })

      const validKey = 'idn_' + 'a'.repeat(64)
      const request = createRequest({ 'Authorization': `Bearer ${validKey}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(401)
        const body = await result.json()
        expect(body.error.code).toBe('expired_api_key')
      }
    })

    it('returns user info for valid active key', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      mockSupabase.__setMockData({
        id: 'key-123',
        user_id: 'user-456',
        revoked_at: null,
        expires_at: null
      })

      const validKey = 'idn_' + 'a'.repeat(64)
      const request = createRequest({ 'Authorization': `Bearer ${validKey}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(false)
      if (!isAuthError(result)) {
        expect(result.userId).toBe('user-456')
        expect(result.keyId).toBe('key-123')
      }
    })

    it('returns user info for key with future expiration', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      mockSupabase.__setMockData({
        id: 'key-123',
        user_id: 'user-456',
        revoked_at: null,
        expires_at: new Date(Date.now() + 86400000).toISOString() // Expires tomorrow
      })

      const validKey = 'idn_' + 'a'.repeat(64)
      const request = createRequest({ 'Authorization': `Bearer ${validKey}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(false)
      if (!isAuthError(result)) {
        expect(result.userId).toBe('user-456')
      }
    })
  })

  describe('isAuthError', () => {
    it('returns true for error responses from validateApiKey', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      // Request without auth header returns an error response
      const request = createRequest()
      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
    })

    it('returns false for successful auth result', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      mockSupabase.__setMockData({
        id: 'key-123',
        user_id: 'user-456',
        revoked_at: null,
        expires_at: null
      })

      const validKey = 'idn_' + 'a'.repeat(64)
      const request = createRequest({ 'Authorization': `Bearer ${validKey}` })
      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(false)
    })
  })

  describe('rateLimitResponse', () => {
    it('returns 429 status', async () => {
      const { rateLimitResponse } = await import('@/lib/api/auth')
      const resetAt = Date.now() + 30000

      const response = rateLimitResponse(resetAt)

      expect(response.status).toBe(429)
    })

    it('includes Retry-After header', async () => {
      const { rateLimitResponse } = await import('@/lib/api/auth')
      const resetAt = Date.now() + 30000

      const response = rateLimitResponse(resetAt)

      expect(response.headers.get('Retry-After')).toBeDefined()
    })

    it('includes X-RateLimit-Reset header', async () => {
      const { rateLimitResponse } = await import('@/lib/api/auth')
      const resetAt = Date.now() + 30000

      const response = rateLimitResponse(resetAt)

      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('returns rate_limited error code', async () => {
      const { rateLimitResponse } = await import('@/lib/api/auth')
      const resetAt = Date.now() + 30000

      const response = rateLimitResponse(resetAt)
      const body = await response.json()

      expect(body.error.code).toBe('rate_limited')
    })

    it('calculates correct Retry-After seconds', async () => {
      const { rateLimitResponse } = await import('@/lib/api/auth')
      const resetAt = Date.now() + 45000 // 45 seconds from now

      const response = rateLimitResponse(resetAt)

      const retryAfter = parseInt(response.headers.get('Retry-After') || '0')
      // Should be approximately 45 seconds (allow for small timing variations)
      expect(retryAfter).toBeGreaterThanOrEqual(44)
      expect(retryAfter).toBeLessThanOrEqual(46)
    })
  })

  describe('JWT validation', () => {
    it('returns valid auth result for valid JWT token', async () => {
      // Mock createClient to return a valid user
      const { createClient } = await import('@supabase/supabase-js')
      vi.mocked(createClient).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'jwt-user-123' } },
            error: null
          })
        }
      } as unknown as ReturnType<typeof createClient>)

      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')

      // Use a JWT-like token (starts with eyJ which is base64 for `{"`)
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const request = createRequest({ 'Authorization': `Bearer ${jwtToken}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(false)
      if (!isAuthError(result)) {
        expect(result.userId).toBe('jwt-user-123')
        expect(result.keyId).toBeNull()
        expect(result.authType).toBe('jwt')
      }
    })

    it('returns error for invalid JWT token', async () => {
      // Reset the mock to return invalid user for this test
      const { createClient } = await import('@supabase/supabase-js')
      vi.mocked(createClient).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid token' }
          })
        }
      } as unknown as ReturnType<typeof createClient>)

      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')

      // Use a JWT-like token that will fail validation
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid'
      const request = createRequest({ 'Authorization': `Bearer ${jwtToken}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(401)
        const body = await result.json()
        expect(body.error.code).toBe('invalid_token')
      }
    })

    it('returns rate limit error when JWT user exceeds rate limit', async () => {
      // Import rate limit module to exhaust the limit
      const { checkRateLimit, API_RATE_LIMITS } = await import('@/lib/api/rate-limit')
      const { createClient } = await import('@supabase/supabase-js')

      // Use a unique user ID for this test
      const testUserId = `jwt-ratelimit-user-${Date.now()}`

      vi.mocked(createClient).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: testUserId } },
            error: null
          })
        }
      } as unknown as ReturnType<typeof createClient>)

      // Exhaust rate limit for this user
      for (let i = 0; i < API_RATE_LIMITS.api.maxRequests; i++) {
        checkRateLimit(`jwt:${testUserId}`, API_RATE_LIMITS.api)
      }

      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')

      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const request = createRequest({ 'Authorization': `Bearer ${jwtToken}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(429)
        const body = await result.json()
        expect(body.error.code).toBe('rate_limited')
      }
    })
  })

  describe('API key validation additional cases', () => {
    it('returns auth type as api_key for valid API key', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      mockSupabase.__setMockData({
        id: 'key-authtype',
        user_id: 'user-authtype',
        revoked_at: null,
        expires_at: null
      })

      const validKey = 'idn_' + 'd'.repeat(64)
      const request = createRequest({ 'Authorization': `Bearer ${validKey}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(false)
      if (!isAuthError(result)) {
        expect(result.authType).toBe('api_key')
      }
    })

    it('returns rate limit error when API key user exceeds rate limit', async () => {
      const { checkRateLimit, API_RATE_LIMITS } = await import('@/lib/api/rate-limit')
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')

      // Use a unique user ID for this test
      const testUserId = `api-ratelimit-user-${Date.now()}`

      mockSupabase.__setMockData({
        id: 'key-ratelimit',
        user_id: testUserId,
        revoked_at: null,
        expires_at: null
      })

      // Exhaust rate limit for this user
      for (let i = 0; i < API_RATE_LIMITS.api.maxRequests; i++) {
        checkRateLimit(`api:${testUserId}`, API_RATE_LIMITS.api)
      }

      const validKey = 'idn_' + 'e'.repeat(64)
      const request = createRequest({ 'Authorization': `Bearer ${validKey}` })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(429)
        const body = await result.json()
        expect(body.error.code).toBe('rate_limited')
      }
    })
  })
})
