import { vi } from 'vitest'

export interface MockOpenAIOptions {
  chatResponse?: string
  embeddingVector?: number[]
  shouldFail?: boolean
  failureMessage?: string
}

export function createMockOpenAI(options: MockOpenAIOptions = {}) {
  const {
    chatResponse = '{"result": "mocked"}',
    embeddingVector = new Array(1536).fill(0.1),
    shouldFail = false,
    failureMessage = 'OpenAI API error'
  } = options

  const mockCreate = shouldFail
    ? vi.fn().mockRejectedValue(new Error(failureMessage))
    : vi.fn().mockResolvedValue({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o-mini',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: chatResponse
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      })

  const mockEmbedding = shouldFail
    ? vi.fn().mockRejectedValue(new Error(failureMessage))
    : vi.fn().mockResolvedValue({
        object: 'list',
        data: [{
          object: 'embedding',
          embedding: embeddingVector,
          index: 0
        }],
        model: 'text-embedding-3-small',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10
        }
      })

  return {
    chat: {
      completions: {
        create: mockCreate
      }
    },
    embeddings: {
      create: mockEmbedding
    },
    _mocks: {
      chatCreate: mockCreate,
      embeddingCreate: mockEmbedding
    }
  }
}

export function mockOpenAIModule(options: MockOpenAIOptions = {}) {
  const mockClient = createMockOpenAI(options)
  vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => mockClient)
  }))
  return mockClient
}
