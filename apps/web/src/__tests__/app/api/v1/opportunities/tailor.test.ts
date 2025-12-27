import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

// Create mocks
const mockSupabaseFrom = vi.fn()
const mockValidateApiKey = vi.fn()
const mockGenerateProfile = vi.fn()
const mockCheckTailoredProfileLimit = vi.fn()
const mockIncrementTailoredProfileCount = vi.fn()

// Mock Supabase service role client
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn().mockImplementation(() => ({
    from: mockSupabaseFrom
  }))
}))

// Mock auth module
vi.mock('@/lib/api/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  isAuthError: (result: unknown) => result instanceof Response
}))

// Mock profile generation
vi.mock('@/lib/ai/generate-profile-api', () => ({
  generateProfileWithClient: (...args: unknown[]) => mockGenerateProfile(...args)
}))

// Mock billing/check-usage
vi.mock('@/lib/billing/check-usage', () => ({
  checkTailoredProfileLimit: (...args: unknown[]) => mockCheckTailoredProfileLimit(...args),
  incrementTailoredProfileCount: (...args: unknown[]) => mockIncrementTailoredProfileCount(...args)
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
  },
  ApiErrors: {
    notFound: (resource: string) => {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'not_found', message: `${resource} not found` }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
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

  const requestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), requestInit)
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  return JSON.parse(text) as T
}

const mockOpportunity = {
  id: 'opp-123',
  title: 'Senior Engineer',
  company: 'Tech Corp'
}

const mockProfileResult = {
  profile: {
    id: 'profile-123',
    narrative: 'I am excited to apply for the Senior Engineer role...',
    resume_data: {
      contact: { name: 'John Doe', email: 'john@example.com' },
      experience: [],
      skills: []
    },
    created_at: '2024-01-01T00:00:00Z'
  },
  cached: false
}

describe('Tailor API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateApiKey.mockResolvedValue({ userId: 'user-123' })
    mockGenerateProfile.mockResolvedValue(mockProfileResult)
    // Default: allow usage
    mockCheckTailoredProfileLimit.mockResolvedValue({ allowed: true })
    mockIncrementTailoredProfileCount.mockResolvedValue(undefined)
  })

  describe('POST /api/v1/opportunities/[id]/tailor', () => {
    it('generates tailored profile successfully', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                table === 'opportunities'
                  ? { data: mockOpportunity, error: null }
                  : { data: null, error: null } // No cached profile
              )
            })
          })
        })
      }))

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/tailor', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{
        success: boolean
        data: {
          id: string
          opportunity: typeof mockOpportunity
          narrative: string
          resume_data: unknown
          cached: boolean
          created_at: string
        }
      }>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.id).toBe('profile-123')
      expect(body.data.narrative).toContain('Senior Engineer')
      expect(body.data.cached).toBe(false)
    })

    it('returns opportunity info in response', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                table === 'opportunities'
                  ? { data: mockOpportunity, error: null }
                  : { data: null, error: null }
              )
            })
          })
        })
      }))

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/tailor', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{
        success: boolean
        data: { opportunity: { id: string; title: string; company: string } }
      }>(response)

      expect(body.data.opportunity.id).toBe('opp-123')
      expect(body.data.opportunity.title).toBe('Senior Engineer')
      expect(body.data.opportunity.company).toBe('Tech Corp')
    })

    it('returns cached profile when available', async () => {
      mockGenerateProfile.mockResolvedValue({
        ...mockProfileResult,
        cached: true
      })

      mockSupabaseFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                table === 'opportunities'
                  ? { data: mockOpportunity, error: null }
                  : { data: { id: 'existing-profile' }, error: null } // Has cached profile
              )
            })
          })
        })
      }))

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/tailor', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{
        success: boolean
        data: { cached: boolean }
      }>(response)

      expect(body.data.cached).toBe(true)
    })

    it('regenerates profile when regenerate flag is true', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                table === 'opportunities'
                  ? { data: mockOpportunity, error: null }
                  : { data: null, error: null }
              )
            })
          })
        })
      }))

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/tailor', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { regenerate: true }
      })

      await POST(request, { params: Promise.resolve({ id: 'opp-123' }) })

      expect(mockGenerateProfile).toHaveBeenCalledWith(
        expect.anything(), // supabase client
        'opp-123',
        'user-123',
        true // regenerate flag
      )
    })

    it('uses regenerate=false by default', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                table === 'opportunities'
                  ? { data: mockOpportunity, error: null }
                  : { data: null, error: null }
              )
            })
          })
        })
      }))

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/tailor', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      await POST(request, { params: Promise.resolve({ id: 'opp-123' }) })

      expect(mockGenerateProfile).toHaveBeenCalledWith(
        expect.anything(),
        'opp-123',
        'user-123',
        false // regenerate flag
      )
    })

    it('handles empty request body gracefully', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                table === 'opportunities'
                  ? { data: mockOpportunity, error: null }
                  : { data: null, error: null }
              )
            })
          })
        })
      }))

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')

      // Request with no body
      const request = new NextRequest(new URL('/api/v1/opportunities/opp-123/tailor', 'http://localhost:3000'), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse

      expect(response.status).toBe(200)
    })

    it('returns 401 when API key is missing', async () => {
      const authError = new Response(JSON.stringify({
        success: false,
        error: { code: 'unauthorized', message: 'Missing API key' }
      }), { status: 401 })

      mockValidateApiKey.mockResolvedValue(authError)

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/tailor')

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse

      expect(response.status).toBe(401)
    })

    it('returns 404 when opportunity not found', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                table === 'opportunities'
                  ? { data: null, error: { message: 'Not found' } }
                  : { data: null, error: null }
              )
            })
          })
        })
      }))

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')
      const request = createMockRequest('/api/v1/opportunities/nonexistent/tailor', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'nonexistent' }) }) as NextResponse
      const body = await parseJsonResponse<{ success: boolean; error: { code: string } }>(response)

      expect(response.status).toBe(404)
      expect(body.error.code).toBe('not_found')
    })

    it('returns 500 when profile generation fails', async () => {
      mockGenerateProfile.mockRejectedValue(new Error('AI generation failed'))

      mockSupabaseFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                table === 'opportunities'
                  ? { data: mockOpportunity, error: null }
                  : { data: null, error: null }
              )
            })
          })
        })
      }))

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/tailor', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{ success: boolean; error: { code: string } }>(response)

      expect(response.status).toBe(500)
      expect(body.error.code).toBe('processing_failed')
    })

    it('includes resume_data in response', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                table === 'opportunities'
                  ? { data: mockOpportunity, error: null }
                  : { data: null, error: null }
              )
            })
          })
        })
      }))

      const { POST } = await import('@/app/api/v1/opportunities/[id]/tailor/route')
      const request = createMockRequest('/api/v1/opportunities/opp-123/tailor', {
        headers: { 'Authorization': 'Bearer idn_test123' }
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'opp-123' }) }) as NextResponse
      const body = await parseJsonResponse<{
        success: boolean
        data: { resume_data: { contact: { name: string } } }
      }>(response)

      expect(body.data.resume_data).toBeDefined()
      expect(body.data.resume_data.contact.name).toBe('John Doe')
    })
  })
})
