import { describe, it, expect, beforeEach, vi } from 'vitest'

// Create the mock embeddings object
const mockEmbeddingsCreate = vi.fn()

// Mock OpenAI before any imports
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: mockEmbeddingsCreate
      }
    }
  }
})

describe('embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock response
    mockEmbeddingsCreate.mockResolvedValue({
      object: 'list',
      data: [{
        object: 'embedding',
        embedding: new Array(1536).fill(0.1),
        index: 0
      }],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 10, total_tokens: 10 }
    })
  })

  describe('generateEmbedding', () => {
    it('generates embedding for single text', async () => {
      const { generateEmbedding } = await import('@/lib/ai/embeddings')
      const expectedVector = new Array(1536).fill(0.1)

      const result = await generateEmbedding('test text')

      expect(result).toEqual(expectedVector)
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
        dimensions: 1536
      })
    })

    it('calls OpenAI embeddings API correctly', async () => {
      const { generateEmbedding } = await import('@/lib/ai/embeddings')

      await generateEmbedding('hello world')

      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
    })

    it('returns the embedding vector from response', async () => {
      const { generateEmbedding } = await import('@/lib/ai/embeddings')

      const result = await generateEmbedding('some text')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1536)
    })
  })

  describe('generateEmbeddings', () => {
    it('returns empty array for empty input', async () => {
      const { generateEmbeddings } = await import('@/lib/ai/embeddings')

      const result = await generateEmbeddings([])

      expect(result).toEqual([])
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
    })

    it('generates embeddings for multiple texts', async () => {
      const { generateEmbeddings } = await import('@/lib/ai/embeddings')

      // Mock response with multiple embeddings
      mockEmbeddingsCreate.mockResolvedValueOnce({
        object: 'list',
        data: [
          { object: 'embedding', embedding: new Array(1536).fill(0.1), index: 0 },
          { object: 'embedding', embedding: new Array(1536).fill(0.2), index: 1 }
        ],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 20, total_tokens: 20 }
      })

      const result = await generateEmbeddings(['text1', 'text2'])

      expect(result.length).toBe(2)
      expect(result[0]).toEqual(new Array(1536).fill(0.1))
      expect(result[1]).toEqual(new Array(1536).fill(0.2))
    })

    it('sorts embeddings by index to maintain order', async () => {
      const { generateEmbeddings } = await import('@/lib/ai/embeddings')

      // Mock response with out-of-order indices
      mockEmbeddingsCreate.mockResolvedValueOnce({
        object: 'list',
        data: [
          { object: 'embedding', embedding: new Array(1536).fill(0.2), index: 1 },
          { object: 'embedding', embedding: new Array(1536).fill(0.1), index: 0 }
        ],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 20, total_tokens: 20 }
      })

      const result = await generateEmbeddings(['first', 'second'])

      // First text should get first embedding (index 0)
      expect(result[0]).toEqual(new Array(1536).fill(0.1))
      expect(result[1]).toEqual(new Array(1536).fill(0.2))
    })

    it('processes large arrays in batches of 100', async () => {
      const { generateEmbeddings } = await import('@/lib/ai/embeddings')

      // Create 150 texts to force 2 batches
      const texts = Array(150).fill('text')

      // Mock responses for two batches
      mockEmbeddingsCreate
        .mockResolvedValueOnce({
          object: 'list',
          data: Array(100).fill(null).map((_, i) => ({
            object: 'embedding',
            embedding: new Array(1536).fill(0.1),
            index: i
          })),
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 1000, total_tokens: 1000 }
        })
        .mockResolvedValueOnce({
          object: 'list',
          data: Array(50).fill(null).map((_, i) => ({
            object: 'embedding',
            embedding: new Array(1536).fill(0.2),
            index: i
          })),
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 500, total_tokens: 500 }
        })

      const result = await generateEmbeddings(texts)

      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
      expect(result.length).toBe(150)
    })

    it('passes correct batch to each API call', async () => {
      const { generateEmbeddings } = await import('@/lib/ai/embeddings')

      const texts = ['text1', 'text2', 'text3']

      mockEmbeddingsCreate.mockResolvedValueOnce({
        object: 'list',
        data: texts.map((_, i) => ({
          object: 'embedding',
          embedding: new Array(1536).fill(0.1),
          index: i
        })),
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 30, total_tokens: 30 }
      })

      await generateEmbeddings(texts)

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: texts,
        dimensions: 1536
      })
    })
  })
})
