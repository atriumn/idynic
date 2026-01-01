import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  setTag: vi.fn(),
  setUser: vi.fn(),
  captureException: vi.fn()
}))

// Mock request-context module
vi.mock('@/lib/request-context', () => {
  let mockContext: { requestId: string; userId?: string; startTime: number } | undefined

  return {
    runWithContext: vi.fn((context, fn) => {
      mockContext = context
      return fn()
    }),
    createRequestContext: vi.fn((requestId: string, userId?: string) => ({
      requestId,
      userId,
      startTime: Date.now()
    })),
    generateRequestId: vi.fn(() => 'generated-request-id'),
    getRequestContext: vi.fn(() => mockContext)
  }
})

// Mock logger
vi.mock('@/lib/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('with-context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('withRequestContext', () => {
    it('wraps handler and adds request context', async () => {
      const { withRequestContext } = await import('@/lib/api/with-context')
      const { runWithContext, createRequestContext } = await import('@/lib/request-context')

      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      const wrappedHandler = withRequestContext(mockHandler)
      const request = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: { 'x-request-id': 'test-request-123' }
      })

      const response = await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request)
      expect(createRequestContext).toHaveBeenCalledWith('test-request-123')
      expect(runWithContext).toHaveBeenCalled()
      expect(response.headers.get('x-request-id')).toBe('test-request-123')
    })

    it('generates request ID when not provided in headers', async () => {
      const { withRequestContext } = await import('@/lib/api/with-context')
      const { generateRequestId, createRequestContext } = await import('@/lib/request-context')

      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      const wrappedHandler = withRequestContext(mockHandler)
      const request = new Request('http://localhost/api/test', { method: 'GET' })

      const response = await wrappedHandler(request)

      expect(generateRequestId).toHaveBeenCalled()
      expect(createRequestContext).toHaveBeenCalledWith('generated-request-id')
      expect(response.headers.get('x-request-id')).toBe('generated-request-id')
    })

    it('logs request start and completion', async () => {
      const { withRequestContext } = await import('@/lib/api/with-context')
      const { log } = await import('@/lib/logger')

      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      )

      const wrappedHandler = withRequestContext(mockHandler)
      const request = new Request('http://localhost/api/v1/profile', { method: 'GET' })

      await wrappedHandler(request)

      expect(log.info).toHaveBeenCalledWith(
        'GET /api/v1/profile',
        expect.objectContaining({ path: '/api/v1/profile', method: 'GET' })
      )
      expect(log.info).toHaveBeenCalledWith(
        'GET /api/v1/profile completed',
        expect.objectContaining({ status: 200 })
      )
    })

    it('sets Sentry tag with request ID', async () => {
      const { withRequestContext } = await import('@/lib/api/with-context')
      const Sentry = await import('@sentry/nextjs')

      const mockHandler = vi.fn().mockResolvedValue(
        new Response('OK', { status: 200 })
      )

      const wrappedHandler = withRequestContext(mockHandler)
      const request = new Request('http://localhost/api/test', {
        headers: { 'x-request-id': 'sentry-test-id' }
      })

      await wrappedHandler(request)

      expect(Sentry.setTag).toHaveBeenCalledWith('request_id', 'sentry-test-id')
    })

    it('handles handler errors and returns 500 response', async () => {
      const { withRequestContext } = await import('@/lib/api/with-context')
      const { log } = await import('@/lib/logger')
      const Sentry = await import('@sentry/nextjs')

      const testError = new Error('Handler failed')
      const mockHandler = vi.fn().mockRejectedValue(testError)

      const wrappedHandler = withRequestContext(mockHandler)
      const request = new Request('http://localhost/api/failing', { method: 'POST' })

      const response = await wrappedHandler(request)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Internal server error')

      expect(log.error).toHaveBeenCalledWith(
        'POST /api/failing failed',
        expect.objectContaining({
          error: 'Handler failed',
          stack: expect.any(String)
        })
      )

      expect(Sentry.captureException).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          extra: expect.objectContaining({
            path: '/api/failing',
            method: 'POST'
          })
        })
      )
    })

    it('flushes logs after successful response', async () => {
      const { withRequestContext } = await import('@/lib/api/with-context')
      const { log } = await import('@/lib/logger')

      const mockHandler = vi.fn().mockResolvedValue(
        new Response('OK', { status: 200 })
      )

      const wrappedHandler = withRequestContext(mockHandler)
      const request = new Request('http://localhost/api/test')

      await wrappedHandler(request)

      expect(log.flush).toHaveBeenCalled()
    })

    it('flushes logs even when handler throws', async () => {
      const { withRequestContext } = await import('@/lib/api/with-context')
      const { log } = await import('@/lib/logger')

      const mockHandler = vi.fn().mockRejectedValue(new Error('Boom'))

      const wrappedHandler = withRequestContext(mockHandler)
      const request = new Request('http://localhost/api/test')

      await wrappedHandler(request)

      expect(log.flush).toHaveBeenCalled()
    })

    it('preserves response headers from handler', async () => {
      const { withRequestContext } = await import('@/lib/api/with-context')

      const mockHandler = vi.fn().mockResolvedValue(
        new Response('OK', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value'
          }
        })
      )

      const wrappedHandler = withRequestContext(mockHandler)
      const request = new Request('http://localhost/api/test')

      const response = await wrappedHandler(request)

      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('X-Custom-Header')).toBe('custom-value')
    })

    it('handles non-Error thrown values', async () => {
      const { withRequestContext } = await import('@/lib/api/with-context')
      const { log } = await import('@/lib/logger')

      const mockHandler = vi.fn().mockRejectedValue('string error')

      const wrappedHandler = withRequestContext(mockHandler)
      const request = new Request('http://localhost/api/test')

      const response = await wrappedHandler(request)

      expect(response.status).toBe(500)
      expect(log.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: 'string error' })
      )
    })
  })

  describe('setContextUserId', () => {
    it('sets user ID in request context', async () => {
      const { setContextUserId } = await import('@/lib/api/with-context')
      const Sentry = await import('@sentry/nextjs')

      setContextUserId('user-123')

      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-123' })
    })
  })
})
