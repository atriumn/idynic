import { describe, it, expect } from 'vitest'
import { SSEStream, createSSEResponse } from '@/lib/sse/stream'
import type { SSEEvent, ProcessingPhase } from '@/lib/sse/types'

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

    it('creates new controller on each createStream call', () => {
      const sse = new SSEStream()
      const stream1 = sse.createStream()

      // The stream should be usable
      expect(stream1).toBeInstanceOf(ReadableStream)
      expect(sse.isClosed).toBe(false)
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

    it('formats phase events with progress', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = { phase: 'synthesis', progress: '3/8' }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('"phase":"synthesis"')
      expect(text).toContain('"progress":"3/8"')
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

    it('formats done events with issuesFound', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = {
        done: true,
        summary: {
          documentId: 'doc-123',
          evidenceCount: 10,
          workHistoryCount: 3,
          claimsCreated: 5,
          claimsUpdated: 2,
          issuesFound: 3
        }
      }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('"issuesFound":3')
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

    it('can send multiple events', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      sse.send({ phase: 'parsing' })
      sse.send({ highlight: 'Found resume' })
      sse.send({ phase: 'extracting' })
      sse.close()

      const reader = stream.getReader()
      const chunks: string[] = []

      // Read all chunks
      let result = await reader.read()
      while (!result.done && result.value) {
        chunks.push(new TextDecoder().decode(result.value))
        result = await reader.read()
      }

      const fullText = chunks.join('')
      expect(fullText).toContain('parsing')
      expect(fullText).toContain('Found resume')
      expect(fullText).toContain('extracting')
    })

    it('handles special characters in event data', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = { highlight: 'Found "quoted" text & special <chars>' }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      // JSON should escape quotes properly
      expect(text).toContain('\\"quoted\\"')
    })

    it('handles unicode in event data', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const event: SSEEvent = { highlight: 'Found skills: TypeScript, React' }
      sse.send(event)
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('TypeScript')
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

    it('returns false before stream is created', () => {
      const sse = new SSEStream()
      expect(sse.isClosed).toBe(false)
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

    it('prevents further sends after close', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      sse.send({ phase: 'parsing' })
      sse.close()
      sse.send({ phase: 'extracting' }) // Should be ignored

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('parsing')
      expect(text).not.toContain('extracting')
    })
  })

  describe('stream cancel behavior', () => {
    it('handles stream cancellation gracefully', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      // Cancel the stream (simulating client disconnect)
      await stream.cancel()

      // Should be closed after cancel
      expect(sse.isClosed).toBe(true)

      // Should not throw when trying to send after cancel
      expect(() => {
        sse.send({ phase: 'extracting' })
      }).not.toThrow()
    })
  })

  describe('all processing phases', () => {
    const phases: ProcessingPhase[] = [
      'validating',
      'parsing',
      'extracting',
      'embeddings',
      'synthesis',
      'reflection',
      'eval',
    ]

    phases.forEach(phase => {
      it(`handles ${phase} phase correctly`, async () => {
        const sse = new SSEStream()
        const stream = sse.createStream()

        sse.send({ phase })
        sse.close()

        const reader = stream.getReader()
        const { value } = await reader.read()
        const text = new TextDecoder().decode(value)

        expect(text).toContain(`"phase":"${phase}"`)
      })
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

  it('uses the provided stream as body', async () => {
    const sse = new SSEStream()
    const stream = sse.createStream()

    sse.send({ phase: 'parsing' })
    sse.close()

    const response = createSSEResponse(stream)

    // The response body should be readable
    expect(response.body).not.toBeNull()

    const reader = response.body?.getReader()
    const { value } = await reader?.read() ?? { value: undefined }
    const text = new TextDecoder().decode(value)

    expect(text).toContain('parsing')
  })

  it('creates response with correct status', () => {
    const sse = new SSEStream()
    const stream = sse.createStream()

    const response = createSSEResponse(stream)

    // Default Response status is 200
    expect(response.status).toBe(200)
  })

  it('creates response that can be consumed as stream', async () => {
    const sse = new SSEStream()
    const stream = sse.createStream()

    // Send multiple events
    sse.send({ phase: 'validating' })
    sse.send({ phase: 'parsing' })
    sse.send({ phase: 'extracting' })
    sse.send({
      done: true,
      summary: {
        documentId: 'doc-1',
        evidenceCount: 5,
        workHistoryCount: 2,
        claimsCreated: 3,
        claimsUpdated: 1,
      },
    })
    sse.close()

    const response = createSSEResponse(stream)
    const reader = response.body?.getReader()
    const chunks: string[] = []

    let result = await reader?.read()
    while (!result?.done && result?.value) {
      chunks.push(new TextDecoder().decode(result.value))
      result = await reader?.read()
    }

    const fullText = chunks.join('')
    expect(fullText).toContain('validating')
    expect(fullText).toContain('parsing')
    expect(fullText).toContain('extracting')
    expect(fullText).toContain('"done":true')
  })
})

describe('SSE event types', () => {
  describe('PhaseEvent', () => {
    it('can have optional progress', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      sse.send({ phase: 'synthesis', progress: '5/10' })
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)
      const data = JSON.parse(text.replace('data: ', '').trim())

      expect(data.phase).toBe('synthesis')
      expect(data.progress).toBe('5/10')
    })
  })

  describe('DoneEvent summary', () => {
    it('includes all required summary fields', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const summary = {
        documentId: 'doc-abc123',
        evidenceCount: 25,
        workHistoryCount: 5,
        claimsCreated: 10,
        claimsUpdated: 3,
      }

      sse.send({ done: true, summary })
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)
      const data = JSON.parse(text.replace('data: ', '').trim())

      expect(data.done).toBe(true)
      expect(data.summary.documentId).toBe('doc-abc123')
      expect(data.summary.evidenceCount).toBe(25)
      expect(data.summary.workHistoryCount).toBe(5)
      expect(data.summary.claimsCreated).toBe(10)
      expect(data.summary.claimsUpdated).toBe(3)
    })

    it('includes optional issuesFound field', async () => {
      const sse = new SSEStream()
      const stream = sse.createStream()

      const summary = {
        documentId: 'doc-abc123',
        evidenceCount: 25,
        workHistoryCount: 5,
        claimsCreated: 10,
        claimsUpdated: 3,
        issuesFound: 7,
      }

      sse.send({ done: true, summary })
      sse.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)
      const data = JSON.parse(text.replace('data: ', '').trim())

      expect(data.summary.issuesFound).toBe(7)
    })
  })
})
