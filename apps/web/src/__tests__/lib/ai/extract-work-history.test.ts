import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ExtractedJob } from '@/lib/ai/extract-work-history'

// Create the mock chat completions object
const mockChatCreate = vi.fn()

// Mock OpenAI before any imports
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

const mockWorkHistory: ExtractedJob[] = [
  {
    company: 'TechCorp Inc.',
    company_domain: 'techcorp.com',
    title: 'Senior Software Engineer',
    start_date: '2020-01',
    end_date: null,
    location: 'San Francisco, CA',
    summary: 'Led platform engineering team',
    entry_type: 'work'
  },
  {
    company: 'StartupXYZ',
    company_domain: null,
    title: 'Software Engineer',
    start_date: '2017-03',
    end_date: '2019-12',
    location: 'New York, NY',
    summary: 'Built core product features',
    entry_type: 'work'
  }
]

describe('extract-work-history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractWorkHistory', () => {
    it('successfully extracts work history', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(mockWorkHistory) }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      const result = await extractWorkHistory('Resume text here')

      expect(result).toEqual(mockWorkHistory)
      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 4000
      }))
    })

    it('calls OpenAI with correct messages', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(mockWorkHistory) }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      await extractWorkHistory('Test resume content')

      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Test resume content')
          })
        ])
      }))
    })

    it('throws error when no response content', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: null }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')

      await expect(extractWorkHistory('Resume text')).rejects.toThrow('No response from AI provider')
    })

    it('cleans markdown code blocks from response', async () => {
      const wrappedResponse = '```json\n' + JSON.stringify(mockWorkHistory) + '\n```'
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: wrappedResponse }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      const result = await extractWorkHistory('Resume text')

      expect(result).toEqual(mockWorkHistory)
    })

    it('throws error when response is not an array', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: '{"not": "an array"}' }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')

      await expect(extractWorkHistory('Resume text')).rejects.toThrow('Failed to parse work history')
    })

    it('throws error for invalid JSON', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'not valid json' }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')

      await expect(extractWorkHistory('Resume text')).rejects.toThrow('Failed to parse work history')
    })

    it('filters out entries missing required company field', async () => {
      const historyWithMissing: ExtractedJob[] = [
        ...mockWorkHistory,
        {
          company: '', // Empty company
          company_domain: null,
          title: 'Some Role',
          start_date: '2020-01',
          end_date: null,
          location: null,
          summary: null,
          entry_type: 'work'
        }
      ]

      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(historyWithMissing) }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      const result = await extractWorkHistory('Resume text')

      // Should filter out the invalid entry
      expect(result).toHaveLength(2)
    })

    it('filters out entries missing required title field', async () => {
      const historyWithMissing = [
        ...mockWorkHistory,
        {
          company: 'Some Company',
          company_domain: null,
          title: '', // Empty title
          start_date: '2020-01',
          end_date: null,
          location: null,
          summary: null,
          entry_type: 'work'
        }
      ]

      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(historyWithMissing) }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      const result = await extractWorkHistory('Resume text')

      expect(result).toHaveLength(2)
    })

    it('filters out entries missing required start_date field', async () => {
      const historyWithMissing = [
        ...mockWorkHistory,
        {
          company: 'Some Company',
          company_domain: null,
          title: 'Some Role',
          start_date: '', // Empty start_date
          end_date: null,
          location: null,
          summary: null,
          entry_type: 'work'
        }
      ]

      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(historyWithMissing) }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      const result = await extractWorkHistory('Resume text')

      expect(result).toHaveLength(2)
    })

    it('provides default title for ventures without title', async () => {
      const ventureWithoutTitle = [
        {
          company: 'My Startup',
          company_domain: null,
          title: '', // Empty title
          start_date: '2021',
          end_date: null,
          location: null,
          summary: 'AI platform',
          entry_type: 'venture' as const
        }
      ]

      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(ventureWithoutTitle) }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      const result = await extractWorkHistory('Resume text')

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Founder')
    })

    it('provides default start_date for ventures without dates', async () => {
      const ventureWithoutDates = [
        {
          company: 'My Startup',
          company_domain: null,
          title: 'Founder',
          start_date: '', // Empty start_date
          end_date: null,
          location: null,
          summary: 'AI platform',
          entry_type: 'venture' as const
        }
      ]

      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(ventureWithoutDates) }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      const result = await extractWorkHistory('Resume text')

      expect(result).toHaveLength(1)
      expect(result[0].start_date).toBe('Ongoing')
    })

    it('handles all entry types correctly', async () => {
      const mixedHistory: ExtractedJob[] = [
        {
          company: 'BigCorp',
          company_domain: 'bigcorp.com',
          title: 'Engineer',
          start_date: '2020',
          end_date: null,
          location: 'NYC',
          summary: 'Work',
          entry_type: 'work'
        },
        {
          company: 'MySideProject',
          company_domain: null,
          title: 'Founder',
          start_date: '2021',
          end_date: null,
          location: null,
          summary: 'Startup',
          entry_type: 'venture'
        },
        {
          company: 'OldJob',
          company_domain: null,
          title: 'Intern',
          start_date: '2015',
          end_date: '2016',
          location: null,
          summary: null,
          entry_type: 'additional'
        }
      ]

      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(mixedHistory) }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      const result = await extractWorkHistory('Resume text')

      expect(result).toHaveLength(3)
      expect(result.map(j => j.entry_type)).toEqual(['work', 'venture', 'additional'])
    })

    it('returns empty array for empty work history', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: '[]' }
        }]
      })

      const { extractWorkHistory } = await import('@/lib/ai/extract-work-history')
      const result = await extractWorkHistory('Resume with no experience')

      expect(result).toEqual([])
    })
  })
})
