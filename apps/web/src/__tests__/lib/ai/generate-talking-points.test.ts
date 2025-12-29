import { describe, it, expect, beforeEach, vi } from 'vitest'

// Create mocks
const mockChatCreate = vi.fn()
const mockSupabaseFrom = vi.fn()

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockChatCreate
        }
      }
    }
  }
})

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: mockSupabaseFrom
  }))
}))

const mockTalkingPointsResponse = {
  strengths: [
    {
      requirement: '5+ years experience',
      requirement_type: 'experience',
      claim_id: 'claim-1',
      claim_label: 'Senior Engineering',
      evidence_summary: 'Led teams at 3 companies',
      framing: 'Emphasize leadership progression',
      confidence: 0.95
    }
  ],
  gaps: [
    {
      requirement: 'Kubernetes experience',
      requirement_type: 'skill',
      mitigation: 'Strong Docker experience demonstrates container fundamentals',
      related_claims: ['claim-2']
    }
  ],
  inferences: [
    {
      inferred_claim: 'Stakeholder management',
      derived_from: ['claim-1'],
      reasoning: 'Multiple executive presentations imply stakeholder management'
    }
  ]
}

describe('generate-talking-points', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default chat response
    mockChatCreate.mockResolvedValue({
      choices: [{
        message: { content: JSON.stringify(mockTalkingPointsResponse) }
      }]
    })
  })

  describe('generateTalkingPoints', () => {
    it('returns empty talking points when opportunity has no requirements', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'opportunities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { requirements: null },
                  error: null
                })
              })
            })
          }
        }
        return {}
      })

      const { generateTalkingPoints } = await import('@/lib/ai/generate-talking-points')
      const result = await generateTalkingPoints('opp-123', 'user-456')

      expect(result).toEqual({ strengths: [], gaps: [], inferences: [] })
      expect(mockChatCreate).not.toHaveBeenCalled()
    })

    it('returns empty talking points when requirements array is empty', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'opportunities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { requirements: { mustHave: [], niceToHave: [] } },
                  error: null
                })
              })
            })
          }
        }
        return {}
      })

      const { generateTalkingPoints } = await import('@/lib/ai/generate-talking-points')
      const result = await generateTalkingPoints('opp-123', 'user-456')

      expect(result).toEqual({ strengths: [], gaps: [], inferences: [] })
    })

    it('returns empty talking points when user has no claims', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'opportunities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    requirements: {
                      mustHave: [{ text: 'TypeScript', type: 'skill' }],
                      niceToHave: []
                    }
                  },
                  error: null
                })
              })
            })
          }
        }
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          }
        }
        return {}
      })

      const { generateTalkingPoints } = await import('@/lib/ai/generate-talking-points')
      const result = await generateTalkingPoints('opp-123', 'user-456')

      expect(result).toEqual({ strengths: [], gaps: [], inferences: [] })
    })

    it('generates talking points successfully', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'opportunities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    requirements: {
                      mustHave: [{ text: '5+ years experience', type: 'experience' }],
                      niceToHave: [{ text: 'Kubernetes', type: 'skill' }]
                    }
                  },
                  error: null
                })
              })
            })
          }
        }
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{
                  id: 'claim-1',
                  label: 'Senior Engineering',
                  type: 'achievement',
                  description: 'Engineering leadership',
                  claim_evidence: [{
                    evidence: {
                      text: 'Led teams at 3 companies',
                      evidence_type: 'accomplishment',
                      context: {}
                    }
                  }]
                }],
                error: null
              })
            })
          }
        }
        return {}
      })

      const { generateTalkingPoints } = await import('@/lib/ai/generate-talking-points')
      const result = await generateTalkingPoints('opp-123', 'user-456')

      expect(result).toEqual(mockTalkingPointsResponse)
      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0.3
      }))
    })

    it('throws error when opportunity fails to load', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'opportunities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Not found' }
                })
              })
            })
          }
        }
        return {}
      })

      const { generateTalkingPoints } = await import('@/lib/ai/generate-talking-points')

      await expect(generateTalkingPoints('opp-123', 'user-456'))
        .rejects.toThrow('Failed to load opportunity')
    })

    it('throws error when claims fail to load', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'opportunities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    requirements: {
                      mustHave: [{ text: 'TypeScript', type: 'skill' }]
                    }
                  },
                  error: null
                })
              })
            })
          }
        }
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB error' }
              })
            })
          }
        }
        return {}
      })

      const { generateTalkingPoints } = await import('@/lib/ai/generate-talking-points')

      await expect(generateTalkingPoints('opp-123', 'user-456'))
        .rejects.toThrow('Failed to load claims')
    })

    it('throws error when AI returns no content', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'opportunities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    requirements: {
                      mustHave: [{ text: 'TypeScript', type: 'skill' }]
                    }
                  },
                  error: null
                })
              })
            })
          }
        }
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{
                  id: 'claim-1',
                  label: 'TypeScript',
                  type: 'skill',
                  description: null,
                  claim_evidence: []
                }],
                error: null
              })
            })
          }
        }
        return {}
      })

      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }]
      })

      const { generateTalkingPoints } = await import('@/lib/ai/generate-talking-points')

      await expect(generateTalkingPoints('opp-123', 'user-456'))
        .rejects.toThrow('No response from AI provider')
    })

    it('throws error for invalid JSON response', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'opportunities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    requirements: {
                      mustHave: [{ text: 'TypeScript', type: 'skill' }]
                    }
                  },
                  error: null
                })
              })
            })
          }
        }
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{
                  id: 'claim-1',
                  label: 'TypeScript',
                  type: 'skill',
                  description: null,
                  claim_evidence: []
                }],
                error: null
              })
            })
          }
        }
        return {}
      })

      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'not valid json' } }]
      })

      const { generateTalkingPoints } = await import('@/lib/ai/generate-talking-points')

      await expect(generateTalkingPoints('opp-123', 'user-456'))
        .rejects.toThrow('Failed to parse talking points')
    })
  })
})
