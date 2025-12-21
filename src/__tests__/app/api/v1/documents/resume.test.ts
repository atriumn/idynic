import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

// Create mocks
const mockSupabaseFrom = vi.fn()
const mockSupabaseStorage = vi.fn()
const mockValidateApiKey = vi.fn()
const mockExtractEvidence = vi.fn()
const mockExtractWorkHistory = vi.fn()
const mockExtractResume = vi.fn()
const mockGenerateEmbeddings = vi.fn()
const mockSynthesizeClaimsBatch = vi.fn()
const mockExtractText = vi.fn()

// Mock Supabase
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn().mockImplementation(() => ({
    from: mockSupabaseFrom,
    storage: {
      from: mockSupabaseStorage
    }
  }))
}))

// Mock auth
vi.mock('@/lib/api/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  isAuthError: (result: unknown) => result instanceof Response
}))

// Mock AI functions
vi.mock('@/lib/ai/extract-evidence', () => ({
  extractEvidence: (...args: unknown[]) => mockExtractEvidence(...args)
}))

vi.mock('@/lib/ai/extract-work-history', () => ({
  extractWorkHistory: (...args: unknown[]) => mockExtractWorkHistory(...args)
}))

vi.mock('@/lib/ai/extract-resume', () => ({
  extractResume: (...args: unknown[]) => mockExtractResume(...args)
}))

vi.mock('@/lib/ai/embeddings', () => ({
  generateEmbeddings: (...args: unknown[]) => mockGenerateEmbeddings(...args)
}))

vi.mock('@/lib/ai/synthesize-claims-batch', () => ({
  synthesizeClaimsBatch: (...args: unknown[]) => mockSynthesizeClaimsBatch(...args)
}))

// Mock PDF extraction
vi.mock('unpdf', () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args)
}))

// Mock SSE - return actual Response to test the stream
vi.mock('@/lib/sse/stream', () => {
  const sentEvents: unknown[] = []
  return {
    SSEStream: class MockSSEStream {
      private closed = false
      createStream() {
        return new ReadableStream({
          start(controller) {
            // Stream will be closed by the route
          }
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

// Mock highlight extraction
vi.mock('@/lib/resume/extract-highlights', () => ({
  extractHighlights: vi.fn().mockReturnValue([])
}))

function createMockFormData(file?: {
  name: string
  type: string
  size: number
  content: ArrayBuffer
}): FormData {
  const formData = new FormData()
  if (file) {
    const blob = new Blob([file.content], { type: file.type })
    formData.append('file', new File([blob], file.name, { type: file.type }))
  }
  return formData
}

describe('Resume Upload API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateApiKey.mockResolvedValue({ userId: 'user-123' })
    mockExtractText.mockResolvedValue({ text: ['Sample resume text content'] })
    mockExtractEvidence.mockResolvedValue([])
    mockExtractWorkHistory.mockResolvedValue([])
    mockExtractResume.mockResolvedValue(null)
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

    mockSupabaseStorage.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null })
    })
  })

  describe('POST /api/v1/documents/resume', () => {
    it('returns 401 when API key is missing', async () => {
      const authError = new Response(JSON.stringify({
        success: false,
        error: { code: 'unauthorized', message: 'Missing API key' }
      }), { status: 401 })

      mockValidateApiKey.mockResolvedValue(authError)

      const { POST } = await import('@/app/api/v1/documents/resume/route')

      const formData = createMockFormData({
        name: 'resume.pdf',
        type: 'application/pdf',
        size: 1024,
        content: new ArrayBuffer(1024)
      })

      const request = new NextRequest('http://localhost:3000/api/v1/documents/resume', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request) as NextResponse

      expect(response.status).toBe(401)
    })

    it('returns SSE stream on successful upload', async () => {
      const { POST } = await import('@/app/api/v1/documents/resume/route')

      const formData = createMockFormData({
        name: 'resume.pdf',
        type: 'application/pdf',
        size: 1024,
        content: new ArrayBuffer(1024)
      })

      const request = new NextRequest('http://localhost:3000/api/v1/documents/resume', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: formData
      })

      const response = await POST(request) as NextResponse

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    })

    it('validates file is provided', async () => {
      const { POST, SSEStream } = await import('@/app/api/v1/documents/resume/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const formData = new FormData() // Empty form data

      const request = new NextRequest('http://localhost:3000/api/v1/documents/resume', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: formData
      })

      await POST(request)

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      expect(events).toContainEqual({ error: 'No file provided' })
    })

    it('validates file type is PDF', async () => {
      const { POST } = await import('@/app/api/v1/documents/resume/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const formData = createMockFormData({
        name: 'resume.txt',
        type: 'text/plain',
        size: 1024,
        content: new ArrayBuffer(1024)
      })

      const request = new NextRequest('http://localhost:3000/api/v1/documents/resume', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: formData
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      expect(events).toContainEqual({ error: 'Only PDF files are supported' })
    })

    it('validates file size is under 10MB', async () => {
      const { POST } = await import('@/app/api/v1/documents/resume/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      // Create a large file (11MB)
      const largeSize = 11 * 1024 * 1024
      const formData = createMockFormData({
        name: 'resume.pdf',
        type: 'application/pdf',
        size: largeSize,
        content: new ArrayBuffer(largeSize)
      })

      const request = new NextRequest('http://localhost:3000/api/v1/documents/resume', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: formData
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      expect(events).toContainEqual({ error: 'File size must be less than 10MB' })
    })

    it('detects duplicate documents', async () => {
      // Mock duplicate detection
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

      const { POST } = await import('@/app/api/v1/documents/resume/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const formData = createMockFormData({
        name: 'resume.pdf',
        type: 'application/pdf',
        size: 1024,
        content: new ArrayBuffer(1024)
      })

      const request = new NextRequest('http://localhost:3000/api/v1/documents/resume', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: formData
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

    it('handles empty PDF text extraction', async () => {
      mockExtractText.mockResolvedValue({ text: [''] })

      const { POST } = await import('@/app/api/v1/documents/resume/route')
      const { getSentEvents, clearEvents } = await import('@/lib/sse/stream') as {
        getSentEvents: () => unknown[]
        clearEvents: () => void
      }

      clearEvents()

      const formData = createMockFormData({
        name: 'empty.pdf',
        type: 'application/pdf',
        size: 1024,
        content: new ArrayBuffer(1024)
      })

      const request = new NextRequest('http://localhost:3000/api/v1/documents/resume', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer idn_test123' },
        body: formData
      })

      await POST(request)

      await new Promise(resolve => setTimeout(resolve, 50))

      const events = getSentEvents()
      expect(events).toContainEqual({ error: 'Could not extract text from PDF' })
    })
  })
})
