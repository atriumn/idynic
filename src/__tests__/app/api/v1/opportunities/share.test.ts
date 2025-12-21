import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

// Create mocks
const mockSupabaseFrom = vi.fn()
const mockValidateApiKey = vi.fn()

// Mock Supabase
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn().mockImplementation(() => ({
    from: mockSupabaseFrom
  }))
}))

// Mock auth
vi.mock('@/lib/api/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  isAuthError: (result: unknown) => result instanceof Response
}))

// Mock response helpers
vi.mock('@/lib/api/response', () => ({
  apiSuccess: (data: unknown) => {
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  },
  apiError: (code: string, message: string, status: number) => {
    return new Response(JSON.stringify({ success: false, error: { code, message } }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}))

function createMockRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: unknown
  } = {}
): NextRequest {
  const { method = 'POST', headers = {}, body } = options

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }

  if (body) {
    requestInit.body = JSON.stringify(body)
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), requestInit)
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  return JSON.parse(text) as T
}

const mockProfile = {
  id: 'profile-123'
}

const mockExistingLink = {
  id: 'link-123',
  token: 'existing-token-abc',
  expires_at: '2025-01-01T00:00:00Z'
}

describe('Share Link API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateApiKey.mockResolvedValue({ userId: 'user-123' })
  })

  describe('POST /api/v1/opportunities/[id]/share', () => {
    it('creates new share link successfully', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tailored_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
                })
              })
            })
          }
        }
        if (table === 'shared_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'new-link-123',
                    token: 'new-token-xyz',
                    expires_at: '2025-02-01T00:00:00Z'
                  },
                  error: null
                })
              })
            })
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/opportunities/[id]/share/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/share', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{
        success: boolean
        data: {
          id: string
          token: string
          url: string
          expires_at: string
          existing: boolean
        }
      }>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.id).toBe('new-link-123')
      expect(body.data.token).toBeDefined()
      expect(body.data.existing).toBe(false)
      expect(body.data.url).toContain('/shared/')
      // URL should contain a token (the locally generated one)
      expect(body.data.url).toMatch(/\/shared\/[a-f0-9]+$/)
    })

    it('returns existing link if one exists', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tailored_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
                })
              })
            })
          }
        }
        if (table === 'shared_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockExistingLink, error: null })
                })
              })
            })
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/opportunities/[id]/share/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/share', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{
        success: boolean
        data: {
          id: string
          token: string
          existing: boolean
        }
      }>(response)

      expect(response.status).toBe(200)
      expect(body.data.id).toBe('link-123')
      expect(body.data.token).toBe('existing-token-abc')
      expect(body.data.existing).toBe(true)
    })

    it('returns 400 when no tailored profile exists', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tailored_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
                })
              })
            })
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/opportunities/[id]/share/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/share', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{
        success: boolean
        error: { code: string; message: string }
      }>(response)

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('validation_error')
      expect(body.error.message).toContain('No tailored profile')
    })

    it('returns 401 when API key is missing', async () => {
      const authError = new Response(JSON.stringify({
        success: false,
        error: { code: 'unauthorized', message: 'Missing API key' }
      }), { status: 401 })

      mockValidateApiKey.mockResolvedValue(authError)

      const { POST } = await import('@/app/api/v1/opportunities/[id]/share/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/share')

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse

      expect(response.status).toBe(401)
    })

    it('accepts custom expiration days', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-link-123',
              token: 'new-token-xyz',
              expires_at: '2025-06-01T00:00:00Z'
            },
            error: null
          })
        })
      })

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tailored_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
                })
              })
            })
          }
        }
        if (table === 'shared_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: insertMock
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/opportunities/[id]/share/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/share', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { expires_in_days: 90 }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse

      expect(response.status).toBe(200)
      expect(insertMock).toHaveBeenCalled()
    })

    it('handles zero expiration days (no expiration)', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-link-123',
              token: 'new-token-xyz',
              expires_at: '2035-01-01T00:00:00Z' // Far future
            },
            error: null
          })
        })
      })

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tailored_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
                })
              })
            })
          }
        }
        if (table === 'shared_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: insertMock
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/opportunities/[id]/share/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/share', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { expires_in_days: 0 }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse

      expect(response.status).toBe(200)
    })

    it('handles empty request body', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tailored_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
                })
              })
            })
          }
        }
        if (table === 'shared_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'new-link', token: 'token', expires_at: '2025-01-01' },
                  error: null
                })
              })
            })
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/opportunities/[id]/share/route')

      const request = new NextRequest(new URL('/api/v1/opportunities/opp-123/share', 'http://localhost:3000'), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse

      expect(response.status).toBe(200)
    })

    it('returns 500 on database insert error', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tailored_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
                })
              })
            })
          }
        }
        if (table === 'shared_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Insert failed' }
                })
              })
            })
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/opportunities/[id]/share/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/share', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{
        success: boolean
        error: { code: string }
      }>(response)

      expect(response.status).toBe(500)
      expect(body.error.code).toBe('server_error')
    })

    it('includes URL in response', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tailored_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
                })
              })
            })
          }
        }
        if (table === 'shared_links') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'new-link-123',
                    token: 'share-token-abc',
                    expires_at: '2025-02-01T00:00:00Z'
                  },
                  error: null
                })
              })
            })
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/opportunities/[id]/share/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/share', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{
        success: boolean
        data: { url: string; token: string }
      }>(response)

      expect(body.data.url).toContain('/shared/')
      // URL contains a hex token
      expect(body.data.url).toMatch(/\/shared\/[a-f0-9]+$/)
    })
  })
})
