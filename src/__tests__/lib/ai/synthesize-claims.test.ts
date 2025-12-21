import { describe, it, expect, beforeEach, vi } from 'vitest'

// Create mocks
const mockChatCreate = vi.fn()
const mockEmbeddingsCreate = vi.fn()
const mockSupabaseRpc = vi.fn()
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
      embeddings = {
        create: mockEmbeddingsCreate
      }
    }
  }
})

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc
  }))
}))

interface EvidenceItem {
  id: string
  text: string
  type: 'accomplishment' | 'skill_listed' | 'trait_indicator' | 'education' | 'certification'
  embedding: number[]
}

const mockEvidence: EvidenceItem = {
  id: 'evidence-1',
  text: 'Led development of customer-facing dashboard serving 100K+ daily users',
  type: 'accomplishment',
  embedding: new Array(1536).fill(0.1)
}

const mockCandidateClaims = [
  {
    id: 'claim-1',
    type: 'achievement',
    label: 'Large Scale Systems',
    description: 'Experience building high-traffic systems',
    confidence: 0.7,
    similarity: 0.85
  }
]

describe('synthesize-claims', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default embedding mock
    mockEmbeddingsCreate.mockResolvedValue({
      object: 'list',
      data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 10, total_tokens: 10 }
    })

    // Default RPC mock for finding candidates
    mockSupabaseRpc.mockResolvedValue({
      data: mockCandidateClaims,
      error: null
    })

    // Default Supabase from mock - enhanced to handle new query patterns
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'identity_claims') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { type: 'skill' },
                error: null
              })
            })
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'new-claim-id' }, error: null })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        }
      } else if (table === 'claim_evidence') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  strength: 'medium',
                  evidence: { source_type: 'resume', evidence_date: null }
                }
              ],
              error: null
            })
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null })
        }
      }
      // Fallback for other tables
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
      }
    })
  })

  describe('synthesizeClaims', () => {
    it('returns zero counts for empty evidence array', async () => {
      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      const result = await synthesizeClaims('user-123', [])

      expect(result).toEqual({ claimsCreated: 0, claimsUpdated: 0 })
      expect(mockSupabaseRpc).not.toHaveBeenCalled()
    })

    it('skips evidence exceeding max length', async () => {
      const longEvidence: EvidenceItem = {
        ...mockEvidence,
        text: 'x'.repeat(5001)
      }

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      const result = await synthesizeClaims('user-123', [longEvidence])

      expect(result).toEqual({ claimsCreated: 0, claimsUpdated: 0 })
      expect(mockSupabaseRpc).not.toHaveBeenCalled()
    })

    it('calls find_candidate_claims RPC for each evidence', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              match: null,
              strength: 'medium',
              new_claim: null
            })
          }
        }]
      })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      await synthesizeClaims('user-123', [mockEvidence])

      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'find_candidate_claims',
        expect.objectContaining({
          match_user_id: 'user-123',
          match_count: 5
        })
      )
    })

    it('creates new claim when AI suggests new_claim', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              match: null,
              strength: 'strong',
              new_claim: {
                type: 'achievement',
                label: 'User Dashboard Development',
                description: 'Built customer-facing dashboards at scale'
              }
            })
          }
        }]
      })

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }) // No existing claim
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'new-claim-123' },
                  error: null
                })
              })
            })
          }
        }
        if (table === 'claim_evidence') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }
      })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      const result = await synthesizeClaims('user-123', [mockEvidence])

      expect(result.claimsCreated).toBe(1)
    })

    it('updates existing claim when AI matches', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              match: 'Large Scale Systems',
              strength: 'strong',
              new_claim: null
            })
          }
        }]
      })

      // Mock claim_evidence upsert
      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'claim_evidence') {
          return {
            upsert: upsertMock,
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ strength: 'strong' }],
                error: null
              })
            })
          }
        }
        if (table === 'identity_claims') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }
      })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      const result = await synthesizeClaims('user-123', [mockEvidence])

      expect(result.claimsUpdated).toBe(1)
    })

    it('handles no response from AI gracefully', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: { content: null }
        }]
      })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      const result = await synthesizeClaims('user-123', [mockEvidence])

      expect(result).toEqual({ claimsCreated: 0, claimsUpdated: 0 })
    })

    it('handles invalid JSON response gracefully', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: { content: 'not valid json' }
        }]
      })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      const result = await synthesizeClaims('user-123', [mockEvidence])

      expect(result).toEqual({ claimsCreated: 0, claimsUpdated: 0 })
    })

    it('cleans markdown code blocks from AI response', async () => {
      const wrappedResponse = '```json\n' + JSON.stringify({
        match: null,
        strength: 'medium',
        new_claim: null
      }) + '\n```'

      mockChatCreate.mockResolvedValue({
        choices: [{
          message: { content: wrappedResponse }
        }]
      })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      const result = await synthesizeClaims('user-123', [mockEvidence])

      // Should not throw - code blocks are cleaned
      expect(result).toEqual({ claimsCreated: 0, claimsUpdated: 0 })
    })

    it('validates new_claim structure before creating', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              match: null,
              strength: 'strong',
              new_claim: {
                type: 'invalid_type', // Invalid type
                label: '',            // Empty label
                description: 123      // Wrong type
              }
            })
          }
        }]
      })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      const result = await synthesizeClaims('user-123', [mockEvidence])

      // Should not create due to invalid structure
      expect(result.claimsCreated).toBe(0)
    })

    it('links evidence to existing claim if label already exists', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              match: null,
              strength: 'strong',
              new_claim: {
                type: 'achievement',
                label: 'Existing Label',
                description: 'Description'
              }
            })
          }
        }]
      })

      // Mock finding existing claim with same label
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'existing-claim-123' },
                    error: null
                  })
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null })
            })
          }
        }
        if (table === 'claim_evidence') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ strength: 'strong' }],
                error: null
              })
            })
          }
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        }
      })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      const result = await synthesizeClaims('user-123', [mockEvidence])

      // Should update instead of create
      expect(result.claimsUpdated).toBe(1)
      expect(result.claimsCreated).toBe(0)
    })

    it('processes multiple evidence items', async () => {
      const evidence2: EvidenceItem = {
        id: 'evidence-2',
        text: 'Mentored 5 junior engineers',
        type: 'accomplishment',
        embedding: new Array(1536).fill(0.2)
      }

      mockChatCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                match: null,
                strength: 'medium',
                new_claim: null
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                match: null,
                strength: 'medium',
                new_claim: null
              })
            }
          }]
        })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      await synthesizeClaims('user-123', [mockEvidence, evidence2])

      expect(mockSupabaseRpc).toHaveBeenCalledTimes(2)
      expect(mockChatCreate).toHaveBeenCalledTimes(2)
    })

    it('handles different evidence types', async () => {
      const skillEvidence: EvidenceItem = {
        id: 'evidence-skill',
        text: 'TypeScript',
        type: 'skill_listed',
        embedding: new Array(1536).fill(0.1)
      }

      mockChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              match: null,
              strength: 'medium',
              new_claim: null
            })
          }
        }]
      })

      const { synthesizeClaims } = await import('@/lib/ai/synthesize-claims')
      await synthesizeClaims('user-123', [skillEvidence])

      // Should include evidence type in prompt
      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('skill_listed')
          })
        ])
      }))
    })
  })
})
