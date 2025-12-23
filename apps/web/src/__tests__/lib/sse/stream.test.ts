import { describe, it, expect } from 'vitest'
import { SSEStream, createSSEResponse } from '@/lib/sse/stream'
import type { SSEEvent } from '@/lib/sse/types'

describe('SSEStream', () => {
  describe('createStream', () => {
    it('returns a readable stream', () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      expect(stream).toBeInstanceOf(ReadableStream)
    })

    it('stream can be read after writing', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = { phase: 'extracting' }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('extracting')
    })
  })

  describe('send', () => {
    it('formats phase events correctly', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = { phase: 'parsing' }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('"phase":"parsing"')
    })

    it('formats highlight events', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = { highlight: 'Found 5 skills' }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('"highlight":"Found 5 skills"')
    })

    it('formats warning events', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = { warning: 'No education found' }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('"warning":"No education found"')
    })

    it('formats error events', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = { error: 'Something went wrong' }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('"error":"Something went wrong"')
    })

    it('formats done events with summary', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = {
        done: true,
        summary: {
          documentId: 'doc-123',
          evidenceCount: 10,
          workHistoryCount: 3,
          claimsCreated: 5,
          claimsUpdated: 2
        }
      }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('"done":true')
      expect(text).toContain('"documentId":"doc-123"')
    })

    it('includes SSE data prefix and newlines', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = { phase: 'validating' }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toMatch(/^data: .*\n\n$/)
    })

    it('silently ignores sends after close', () => {
      const sse = new SSEStream()
      sse.createStream()
      sse.close()

      // Should not throw
      expect(() => {
        sse.send({ phase: 'extracting' })
      }).not.toThrow()
    })

    it('silently ignores sends before stream is created', () => {
      const sse = new SSEStream()

      // Should not throw
      expect(() => {
        sse.send({ phase: 'extracting' })
      }).not.toThrow()
    })
  })

  describe('isClosed', () => {
    it('returns false when stream is open', () => {
      const sse = new SSEStream()
      sse.createStream()

      expect(sse.isClosed).toBe(false)
    })

    it('returns true after close', () => {
      const sse = new SSEStream()
      sse.createStream()
      sse.close()

      expect(sse.isClosed).toBe(true)
    })
  })

  describe('close', () => {
    it('closes the stream', () => {
      const sse = new SSEStream()
      sse.createStream()

      sse.close()

      expect(sse.isClosed).toBe(true)
    })

    it('can be called multiple times safely', () => {
      const sse = new SSEStream()
      sse.createStream()

      expect(() => {
        sse.close()
        sse.close()
        sse.close()
      }).not.toThrow()
    })

    it('can be called without creating stream', () => {
      const sse = new SSEStream()

      expect(() => {
        sse.close()
      }).not.toThrow()
    })
  })
})

describe('createSSEResponse', () => {
  it('returns a Response object', () => {
    const sse = new SSEStream()
    const stream = sse.createStream()

    const response = createSSEResponse(stream)

    expect(response).toBeInstanceOf(Response)
  })

  it('sets correct content-type header', () => {
    const sse = new SSEStream()
    const stream = sse.createStream()

    const response = createSSEResponse(stream)

    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('sets cache-control header', () => {
    const sse = new SSEStream()
    const stream = sse.createStream()

    const response = createSSEResponse(stream)

    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
  })

  it('sets connection header', () => {
    const sse = new SSEStream()
    const stream = sse.createStream()

    const response = createSSEResponse(stream)

    expect(response.headers.get('Connection')).toBe('keep-alive')
  })
})
