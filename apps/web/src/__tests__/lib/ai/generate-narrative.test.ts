import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { TalkingPoints } from '@/lib/ai/generate-talking-points'

// Create mock
const mockChatCreate = vi.fn()

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

const mockTalkingPoints: TalkingPoints = {
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

describe('generate-narrative', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default narrative response
    mockChatCreate.mockResolvedValue({
      choices: [{
        message: {
          content: 'I am excited to apply for the Senior Engineer role at Acme Corp...'
        }
      }]
    })
  })

  describe('generateNarrative', () => {
    it('returns empty string when no strengths or gaps', async () => {
      const { generateNarrative } = await import('@/lib/ai/generate-narrative')

      const emptyPoints: TalkingPoints = {
        strengths: [],
        gaps: [],
        inferences: []
      }

      const result = await generateNarrative(emptyPoints, 'Senior Engineer', 'Acme Corp')

      expect(result).toBe('')
      expect(mockChatCreate).not.toHaveBeenCalled()
    })

    it('generates narrative for talking points', async () => {
      const { generateNarrative } = await import('@/lib/ai/generate-narrative')

      const result = await generateNarrative(mockTalkingPoints, 'Senior Engineer', 'Acme Corp')

      expect(result).toContain('Senior Engineer')
      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 1000
      }))
    })

    it('includes job title and company in prompt', async () => {
      const { generateNarrative } = await import('@/lib/ai/generate-narrative')

      await generateNarrative(mockTalkingPoints, 'Senior Engineer', 'Acme Corp')

      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Senior Engineer')
          })
        ])
      }))
    })

    it('handles null company', async () => {
      const { generateNarrative } = await import('@/lib/ai/generate-narrative')

      const result = await generateNarrative(mockTalkingPoints, 'Senior Engineer', null)

      expect(result).toBeDefined()
      // Prompt should not contain "at null"
      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.not.stringContaining('at null')
          })
        ])
      }))
    })

    it('throws error when no response', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }]
      })

      const { generateNarrative } = await import('@/lib/ai/generate-narrative')

      await expect(generateNarrative(mockTalkingPoints, 'Engineer', 'Corp'))
        .rejects.toThrow('No response from AI provider')
    })

    it('trims whitespace from response', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: '  \n  Narrative content here  \n  ' }
        }]
      })

      const { generateNarrative } = await import('@/lib/ai/generate-narrative')
      const result = await generateNarrative(mockTalkingPoints, 'Engineer', 'Corp')

      expect(result).toBe('Narrative content here')
    })

    it('works with only strengths', async () => {
      const pointsWithOnlyStrengths: TalkingPoints = {
        strengths: mockTalkingPoints.strengths,
        gaps: [],
        inferences: []
      }

      const { generateNarrative } = await import('@/lib/ai/generate-narrative')
      const result = await generateNarrative(pointsWithOnlyStrengths, 'Engineer', 'Corp')

      expect(result).toBeDefined()
      expect(mockChatCreate).toHaveBeenCalled()
    })

    it('works with only gaps', async () => {
      const pointsWithOnlyGaps: TalkingPoints = {
        strengths: [],
        gaps: mockTalkingPoints.gaps,
        inferences: []
      }

      const { generateNarrative } = await import('@/lib/ai/generate-narrative')
      const result = await generateNarrative(pointsWithOnlyGaps, 'Engineer', 'Corp')

      expect(result).toBeDefined()
      expect(mockChatCreate).toHaveBeenCalled()
    })
  })
})
