import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('request-context', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('createRequestContext', () => {
    it('creates context with request ID and start time', async () => {
      const { createRequestContext } = await import('@/lib/request-context')
      const before = Date.now()

      const context = createRequestContext('req-123')

      expect(context.requestId).toBe('req-123')
      expect(context.startTime).toBeGreaterThanOrEqual(before)
      expect(context.startTime).toBeLessThanOrEqual(Date.now())
      expect(context.userId).toBeUndefined()
    })

    it('creates context with user ID when provided', async () => {
      const { createRequestContext } = await import('@/lib/request-context')

      const context = createRequestContext('req-456', 'user-789')

      expect(context.requestId).toBe('req-456')
      expect(context.userId).toBe('user-789')
    })
  })

  describe('generateRequestId', () => {
    it('generates an ID using crypto.randomUUID', async () => {
      const { generateRequestId } = await import('@/lib/request-context')

      const id = generateRequestId()

      // The vitest setup mocks randomUUID to return test-uuid-N
      expect(id).toContain('uuid')
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('generates different IDs on each call', async () => {
      const { generateRequestId } = await import('@/lib/request-context')

      const ids = new Set<string>()
      for (let i = 0; i < 10; i++) {
        ids.add(generateRequestId())
      }

      expect(ids.size).toBe(10)
    })
  })

  describe('runWithContext and getRequestContext', () => {
    it('provides context inside the run function', async () => {
      const { runWithContext, getRequestContext, createRequestContext } = await import('@/lib/request-context')

      const context = createRequestContext('ctx-test')
      let capturedContext: ReturnType<typeof getRequestContext>

      runWithContext(context, () => {
        capturedContext = getRequestContext()
      })

      expect(capturedContext!).toBe(context)
      expect(capturedContext!.requestId).toBe('ctx-test')
    })

    it('returns undefined outside of context', async () => {
      const { getRequestContext } = await import('@/lib/request-context')

      const context = getRequestContext()

      expect(context).toBeUndefined()
    })

    it('returns value from run function', async () => {
      const { runWithContext, createRequestContext } = await import('@/lib/request-context')

      const context = createRequestContext('return-test')

      const result = runWithContext(context, () => {
        return 'test-value'
      })

      expect(result).toBe('test-value')
    })

    it('isolates context between runs', async () => {
      const { runWithContext, getRequestContext, createRequestContext } = await import('@/lib/request-context')

      const context1 = createRequestContext('ctx-1')
      const context2 = createRequestContext('ctx-2')

      let captured1: ReturnType<typeof getRequestContext>
      let captured2: ReturnType<typeof getRequestContext>

      runWithContext(context1, () => {
        captured1 = getRequestContext()
        runWithContext(context2, () => {
          captured2 = getRequestContext()
        })
      })

      expect(captured1!.requestId).toBe('ctx-1')
      expect(captured2!.requestId).toBe('ctx-2')
    })
  })

  describe('getRequestId', () => {
    it('returns request ID from context', async () => {
      const { runWithContext, getRequestId, createRequestContext } = await import('@/lib/request-context')

      const context = createRequestContext('id-test')

      let capturedId: string | undefined

      runWithContext(context, () => {
        capturedId = getRequestId()
      })

      expect(capturedId).toBe('id-test')
    })

    it('returns undefined outside of context', async () => {
      const { getRequestId } = await import('@/lib/request-context')

      const id = getRequestId()

      expect(id).toBeUndefined()
    })
  })
})
