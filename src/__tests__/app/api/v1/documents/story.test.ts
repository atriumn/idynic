import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

// Create mocks
const mockSupabaseFrom = vi.fn()
const mockValidateApiKey = vi.fn()
const mockExtractStoryEvidence = vi.fn()
const mockGenerateEmbeddings = vi.fn()
const mockSynthesizeClaimsBatch = vi.fn()

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

// Mock AI functions
vi.mock('@/lib/ai/extract-story-evidence', () => ({
  extractStoryEvidence: (...args: unknown[]) => mockExtractStoryEvidence(...args)
}))

vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbeddings: (...args: unknown[]) => mockGenerateEmbeddings(...args)
}))

vi.mock('@/lib/ai/synthesize-claims-batch', () => ({
  synthesizeClaimsBatch: (...args: unknown[]) => mockSynthesizeClaimsBatch(...args)
}))

// Mock SSE
vi.mock('@/lib/sse/stream', () => {
  const sentEvents: unknown[] = []
  return {
    SSEStream: class MockSSEStream {
      private closed = false
      createStream() {
        return new ReadableStream({
          start() {}
        })
      }
      send(event: unknown) {
        if (!this.closed) {
          sentEvents.push(event)
        }
      }
      close() {
        this.closed = true
      }
      get isClosed() {
        return this.closed
      }
    },
    createSSEResponse: (stream: ReadableStream) => {
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      })
    },
    getSentEvents: () => sentEvents,
    clearEvents: () => { sentEvents.length = 0 }
  }
})

function createMockRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: unknown
  } = {}
): NextRequest {
  const { method = 'POST', headers = {}, body } = options

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  })
}

describe('Story Upload API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateApiKey.mockResolvedValue({ userId: 'user-123' })
    mockExtractStoryEvidence.mockResolvedValue([])
    mockGenerateEmbeddings.mockResolvedValue([])
    mockSynthesizeClaimsBatch.mockResolvedValue({ claimsCreated: 0, claimsUpdated: 0 })

    // Default Supabase mocks
    mockSupabaseFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'doc-123' },
            error: null
          })
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })
    }))
  })

  describe('POST /api/v1/documents/story', () => {
    it('returns 401 when API key is missing', async () => {
      const authError = new Response(JSON.stringify({
        success: false,
        error: { code: 'unauthorized', message: 'Missing API key' }
      }), { status: 401 })

      mockValidateApiKey.mockResolvedValue(authError)

      const { POST } = await import('@/app/api/v1/documents/story/route')

      const request = createMockRequest('/api/v1/documents/story', {
        headers: { 'Authorization': 'Bearer invalid' },
        body: { text: 'A'.repeat(300) }
      })

      const response = await POST(request) as NextResponse

      expect(response.status).toBe(401)
    })

    it('returns SSE stream on successful upload', async () => {
      const { POST } = await import('@/app/api/v1/documents/story/route')

      const request = createMockRequest('/api/v1/documents/story', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { text: 'A'.repeat(300) }
      })

      const response = await POST(request) as NextResponse

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    })

    it('validates story text is provided', async () => {
      const { POST } = await import('@/app/api/v1/documents/story/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const request = createMockRequest('/api/v1/documents/story', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: {}
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      expect(events).toContainEqual({ error: 'No story text provided' })
    })

    it('validates story minimum length (200 chars)', async () => {
      const { POST } = await import('@/app/api/v1/documents/story/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const request = createMockRequest('/api/v1/documents/story', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { text: 'Too short' }
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      expect(events).toContainEqual({ error: 'Story must be at least 200 characters' })
    })

    it('validates story maximum length (10000 chars)', async () => {
      const { POST } = await import('@/app/api/v1/documents/story/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const request = createMockRequest('/api/v1/documents/story', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { text: 'A'.repeat(10001) }
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      expect(events).toContainEqual({ error: 'Story must be less than 10,000 characters' })
    })

    it('detects duplicate stories', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'documents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'existing-doc', created_at: '2024-01-01' },
                    error: null
                  })
                })
              })
            })
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/documents/story/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const request = createMockRequest('/api/v1/documents/story', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { text: 'A'.repeat(300) }
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      const errorEvent = events.find((e: unknown) =>
        typeof e === 'object' && e !== null && 'error' in e &&
        (e as { error: string }).error.includes('Duplicate')
      )
      expect(errorEvent).toBeDefined()
    })

    it('sends validating phase event', async () => {
      const { POST } = await import('@/app/api/v1/documents/story/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const request = createMockRequest('/api/v1/documents/story', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { text: 'A'.repeat(300) }
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      expect(events).toContainEqual({ phase: 'validating' })
    })

    it('handles extraction error gracefully', async () => {
      mockExtractStoryEvidence.mockRejectedValue(new Error('AI extraction failed'))

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'documents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            })
          }
        }
        return {}
      })

      const { POST } = await import('@/app/api/v1/documents/story/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const request = createMockRequest('/api/v1/documents/story', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { text: 'A'.repeat(300) }
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 100))

      const events = getSentEvents()
      expect(events).toContainEqual({ error: 'Failed to extract evidence from story' })
    })

    it('validates text is a string', async () => {
      const { POST } = await import('@/app/api/v1/documents/story/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const request = createMockRequest('/api/v1/documents/story', {
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: { text: 12345 } // Number instead of string
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      expect(events).toContainEqual({ error: 'No story text provided' })
    })
  })
})
