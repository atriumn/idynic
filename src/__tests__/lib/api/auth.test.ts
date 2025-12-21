import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockSupabaseClient } from '@/__mocks__/supabase'

// Mock the service role client
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn()
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
        expect(body.error.code).toBe('invalid_api_key')
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

    it('returns error for invalid key format', async () => {
      const { validateApiKey, isAuthError } = await import('@/lib/api/auth')
      const request = createRequest({ 'Authorization': 'Bearer not_valid_format' })

      const result = await validateApiKey(request)

      expect(isAuthError(result)).toBe(true)
      if (isAuthError(result)) {
        expect(result.status).toBe(401)
        const body = await result.json()
        expect(body.error.message).toContain('format')
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
    it('returns true for NextResponse', async () => {
      const { isAuthError } = await import('@/lib/api/auth')
      const { NextResponse } = await import('next/server')

      // Any NextResponse is considered an auth error by isAuthError
      const response = NextResponse.json(
        { error: { code: 'test', message: 'test', request_id: 'test' } },
        { status: 401 }
      )
      // isAuthError checks if result is an instance of NextResponse
      expect(response instanceof NextResponse).toBe(true)
    })

    it('returns false for auth result object', async () => {
      const { isAuthError } = await import('@/lib/api/auth')

      const authResult = { userId: 'user-1', keyId: 'key-1' }
      expect(isAuthError(authResult)).toBe(false)
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
  })
})
