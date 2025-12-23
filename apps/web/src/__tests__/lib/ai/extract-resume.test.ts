import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ResumeExtraction } from '@/lib/ai/extract-resume'

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

const mockValidExtraction: ResumeExtraction = {
  contact: {
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '(555) 123-4567',
    location: 'San Francisco, CA',
    linkedin: null,
    github: null,
    website: null
  },
  summary: 'Experienced software engineer with 8+ years building scalable web applications.',
  experience: [
    {
      company: 'TechCorp Inc.',
      role: 'Senior Software Engineer',
      start_date: '2020-01',
      end_date: null,
      is_current: true,
      location: 'San Francisco, CA',
      bullets: [
        'Led development of customer-facing dashboard serving 100K+ daily users',
        'Reduced API latency by 40% through caching and query optimization'
      ]
    }
  ],
  education: [
    {
      school: 'University of California, Berkeley',
      degree: 'B.S.',
      field: 'Computer Science',
      start_date: '2011-09',
      end_date: '2015-05',
      gpa: null
    }
  ],
  skills: ['TypeScript', 'JavaScript', 'React', 'Node.js', 'PostgreSQL'],
  certifications: [],
  projects: []
}

describe('extract-resume', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractResume', () => {
    it('successfully extracts resume data', async () => {
      mockChatCreate.mockResolvedValueOnce({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o-mini',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify(mockValidExtraction)
          },
          finish_reason: 'stop'
        }]
      })

      const { extractResume } = await import('@/lib/ai/extract-resume')
      const result = await extractResume('Resume text here')

      expect(result).toEqual(mockValidExtraction)
      expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 16000
      }))
    })

    it('calls OpenAI with correct messages', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(mockValidExtraction) }
        }]
      })

      const { extractResume } = await import('@/lib/ai/extract-resume')
      await extractResume('Test resume content')

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

      const { extractResume } = await import('@/lib/ai/extract-resume')

      await expect(extractResume('Resume text')).rejects.toThrow('No response from OpenAI')
    })

    it('throws error when response is empty', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: '' }
        }]
      })

      const { extractResume } = await import('@/lib/ai/extract-resume')

      // Empty string is falsy, should throw no response error
      await expect(extractResume('Resume text')).rejects.toThrow('No response from OpenAI')
    })

    it('cleans markdown code blocks from response', async () => {
      const wrappedResponse = '```json\n' + JSON.stringify(mockValidExtraction) + '\n```'
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: wrappedResponse }
        }]
      })

      const { extractResume } = await import('@/lib/ai/extract-resume')
      const result = await extractResume('Resume text')

      expect(result).toEqual(mockValidExtraction)
    })

    it('handles response without json prefix in code block', async () => {
      const wrappedResponse = '```\n' + JSON.stringify(mockValidExtraction) + '\n```'
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: wrappedResponse }
        }]
      })

      const { extractResume } = await import('@/lib/ai/extract-resume')
      const result = await extractResume('Resume text')

      expect(result).toEqual(mockValidExtraction)
    })

    it('throws error for invalid JSON response', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'This is not valid JSON at all' }
        }]
      })

      const { extractResume } = await import('@/lib/ai/extract-resume')

      await expect(extractResume('Resume text')).rejects.toThrow('Failed to parse extraction response')
    })

    it('includes partial content in parse error message', async () => {
      const invalidContent = 'Invalid JSON content that should appear in error'
      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: invalidContent }
        }]
      })

      const { extractResume } = await import('@/lib/ai/extract-resume')

      await expect(extractResume('Resume text')).rejects.toThrow(/Invalid JSON content/)
    })

    it('handles missing choices array', async () => {
      mockChatCreate.mockResolvedValueOnce({
        choices: []
      })

      const { extractResume } = await import('@/lib/ai/extract-resume')

      await expect(extractResume('Resume text')).rejects.toThrow()
    })

    it('preserves all extracted fields correctly', async () => {
      const fullExtraction: ResumeExtraction = {
        contact: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-0100',
          location: 'New York, NY',
          linkedin: 'linkedin.com/in/janedoe',
          github: 'github.com/janedoe',
          website: 'janedoe.dev'
        },
        summary: 'Full stack developer',
        experience: [
          {
            company: 'BigCo',
            role: 'Developer',
            start_date: '2020-01',
            end_date: '2023-06',
            is_current: false,
            location: 'Remote',
            bullets: ['Built things', 'Fixed bugs']
          }
        ],
        education: [
          {
            school: 'MIT',
            degree: 'MS',
            field: 'CS',
            start_date: '2018-09',
            end_date: '2020-05',
            gpa: '4.0'
          }
        ],
        skills: ['Python', 'Go'],
        certifications: [
          { name: 'AWS SAA', issuer: 'Amazon', date: '2023-01' }
        ],
        projects: [
          {
            name: 'Side Project',
            description: 'Cool thing',
            bullets: ['Feature 1'],
            technologies: ['React']
          }
        ]
      }

      mockChatCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: JSON.stringify(fullExtraction) }
        }]
      })

      const { extractResume } = await import('@/lib/ai/extract-resume')
      const result = await extractResume('Resume text')

      expect(result.contact.linkedin).toBe('linkedin.com/in/janedoe')
      expect(result.certifications).toHaveLength(1)
      expect(result.projects).toHaveLength(1)
    })
  })
})
