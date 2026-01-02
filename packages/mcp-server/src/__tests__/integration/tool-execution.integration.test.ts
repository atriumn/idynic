/**
 * Tool Execution Integration Tests
 *
 * These tests verify that MCP tools correctly execute and return expected results
 * when called with valid arguments. Uses mock API responses to simulate real
 * Supabase/API behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdynicClient } from '../../client.js'
import { executeTool, tools } from '../../tools.js'
import {
  createMockFetch,
  createTestProfile,
  createTestClaims,
  createTestOpportunity,
  createTestOpportunities,
  createTestMatchAnalysis,
  createTestTailoredProfile,
  createTestShareLink,
} from '../mocks/api-client.js'

describe('Tool Execution Integration Tests', () => {
  let client: IdynicClient
  let mockFetch: ReturnType<typeof createMockFetch>

  beforeEach(() => {
    mockFetch = createMockFetch()
    global.fetch = mockFetch as unknown as typeof fetch
    client = new IdynicClient('valid-test-api-key', 'https://api.test.com')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Profile Tools', () => {
    describe('get_profile', () => {
      it('returns complete profile data for authenticated user', async () => {
        const result = await executeTool(client, 'get_profile', {})

        expect(result.content).toHaveLength(1)
        expect(result.content[0].type).toBe('text')

        const profileData = JSON.parse(result.content[0].text)
        expect(profileData.contact).toBeDefined()
        expect(profileData.contact.name).toBe('Test User')
        expect(profileData.contact.email).toBe('test@example.com')
        expect(profileData.experience).toBeDefined()
        expect(profileData.skills).toBeDefined()
        expect(profileData.education).toBeDefined()
      })

      it('includes work history in profile', async () => {
        const result = await executeTool(client, 'get_profile', {})
        const profileData = JSON.parse(result.content[0].text)

        expect(profileData.experience).toBeInstanceOf(Array)
        expect(profileData.experience.length).toBeGreaterThan(0)
        expect(profileData.experience[0]).toHaveProperty('company')
        expect(profileData.experience[0]).toHaveProperty('title')
      })

      it('includes skills with confidence scores', async () => {
        const result = await executeTool(client, 'get_profile', {})
        const profileData = JSON.parse(result.content[0].text)

        expect(profileData.skills).toBeInstanceOf(Array)
        expect(profileData.skills.length).toBeGreaterThan(0)
        expect(profileData.skills[0]).toHaveProperty('label')
        expect(profileData.skills[0]).toHaveProperty('confidence')
      })
    })

    describe('update_profile', () => {
      it('updates profile with valid contact information', async () => {
        const result = await executeTool(client, 'update_profile', {
          name: 'Updated Name',
          email: 'updated@example.com',
        })

        expect(result.content[0].text).toContain('updated successfully')
      })

      it('accepts partial updates', async () => {
        const result = await executeTool(client, 'update_profile', {
          location: 'New York, NY',
        })

        expect(result.content[0].text).toContain('updated successfully')
      })

      it('updates social URLs', async () => {
        const result = await executeTool(client, 'update_profile', {
          linkedin: 'https://linkedin.com/in/newprofile',
          github: 'https://github.com/newuser',
          website: 'https://newsite.dev',
        })

        expect(result.content[0].text).toContain('updated successfully')
      })

      it('rejects invalid email format', async () => {
        const result = await executeTool(client, 'update_profile', {
          email: 'invalid-email',
        })

        expect(result.content[0].text).toContain('Error')
      })

      it('rejects invalid URL format for linkedin', async () => {
        const result = await executeTool(client, 'update_profile', {
          linkedin: 'not-a-url',
        })

        expect(result.content[0].text).toContain('Error')
      })
    })

    describe('get_claims', () => {
      it('returns identity claims with confidence scores', async () => {
        const result = await executeTool(client, 'get_claims', {})

        const claims = JSON.parse(result.content[0].text)
        expect(claims).toBeInstanceOf(Array)
        expect(claims.length).toBeGreaterThan(0)
        expect(claims[0]).toHaveProperty('id')
        expect(claims[0]).toHaveProperty('type')
        expect(claims[0]).toHaveProperty('label')
        expect(claims[0]).toHaveProperty('confidence')
      })

      it('includes various claim types', async () => {
        const result = await executeTool(client, 'get_claims', {})
        const claims = JSON.parse(result.content[0].text)

        const types = new Set(claims.map((c: { type: string }) => c.type))
        expect(types.size).toBeGreaterThan(0)
      })
    })
  })

  describe('Opportunity Tools', () => {
    describe('list_opportunities', () => {
      it('returns all opportunities when no filter provided', async () => {
        const result = await executeTool(client, 'list_opportunities', {})

        const opportunities = JSON.parse(result.content[0].text)
        expect(opportunities).toBeInstanceOf(Array)
        expect(opportunities.length).toBeGreaterThan(0)
      })

      it('includes match scores for opportunities', async () => {
        const result = await executeTool(client, 'list_opportunities', {})
        const opportunities = JSON.parse(result.content[0].text)

        opportunities.forEach((opp: { match_score: number }) => {
          expect(opp.match_score).toBeDefined()
        })
      })

      it('filters opportunities by status', async () => {
        const result = await executeTool(client, 'list_opportunities', {
          status: 'tracking',
        })

        const opportunities = JSON.parse(result.content[0].text)
        opportunities.forEach((opp: { status: string }) => {
          expect(opp.status).toBe('tracking')
        })
      })

      it('returns empty array for status with no matches', async () => {
        mockFetch = createMockFetch({ opportunities: [] })
        global.fetch = mockFetch as unknown as typeof fetch

        const result = await executeTool(client, 'list_opportunities', {
          status: 'nonexistent',
        })

        const opportunities = JSON.parse(result.content[0].text)
        expect(opportunities).toEqual([])
      })
    })

    describe('get_opportunity', () => {
      it('returns opportunity details by ID', async () => {
        const testOpp = createTestOpportunity()
        mockFetch = createMockFetch({ opportunities: [testOpp] })
        global.fetch = mockFetch as unknown as typeof fetch

        const result = await executeTool(client, 'get_opportunity', {
          id: testOpp.id,
        })

        const opportunity = JSON.parse(result.content[0].text)
        expect(opportunity.id).toBe(testOpp.id)
        expect(opportunity.title).toBe(testOpp.title)
        expect(opportunity.company).toBe(testOpp.company)
      })

      it('validates UUID format for ID', async () => {
        const result = await executeTool(client, 'get_opportunity', {
          id: 'invalid-id',
        })

        expect(result.content[0].text).toContain('Error')
      })

      it('returns error for non-existent opportunity', async () => {
        const result = await executeTool(client, 'get_opportunity', {
          id: '00000000-0000-0000-0000-000000000000',
        })

        expect(result.content[0].text).toContain('Error')
      })
    })

    describe('add_opportunity', () => {
      it('adds opportunity with job description', async () => {
        const description = 'A'.repeat(100) // Minimum 50 chars

        const result = await executeTool(client, 'add_opportunity', {
          description,
        })

        expect(result.content[0].text).toContain('added')
        expect(result.content[0].text).not.toContain('Error')
      })

      it('adds opportunity with URL and description', async () => {
        const result = await executeTool(client, 'add_opportunity', {
          url: 'https://jobs.example.com/software-engineer',
          description: 'We are looking for a software engineer with 5+ years experience in React and TypeScript...',
        })

        expect(result.content[0].text).toContain('added')
      })

      it('validates minimum description length (50 chars)', async () => {
        const result = await executeTool(client, 'add_opportunity', {
          description: 'Too short',
        })

        expect(result.content[0].text).toContain('Error')
      })

      it('validates URL format when provided', async () => {
        const result = await executeTool(client, 'add_opportunity', {
          url: 'not-a-valid-url',
          description: 'A'.repeat(100),
        })

        expect(result.content[0].text).toContain('Error')
      })
    })

    describe('analyze_match', () => {
      it('returns match analysis with score', async () => {
        const testOpp = createTestOpportunity()
        const testMatch = createTestMatchAnalysis()
        mockFetch = createMockFetch({
          opportunities: [testOpp],
          matches: new Map([[testOpp.id, testMatch]]),
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const result = await executeTool(client, 'analyze_match', {
          id: testOpp.id,
        })

        const match = JSON.parse(result.content[0].text)
        expect(match.score).toBeDefined()
        expect(typeof match.score).toBe('number')
      })

      it('includes strengths, gaps, and recommendations', async () => {
        const testOpp = createTestOpportunity()
        const testMatch = createTestMatchAnalysis()
        mockFetch = createMockFetch({
          opportunities: [testOpp],
          matches: new Map([[testOpp.id, testMatch]]),
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const result = await executeTool(client, 'analyze_match', {
          id: testOpp.id,
        })

        const match = JSON.parse(result.content[0].text)
        expect(match.strengths).toBeInstanceOf(Array)
        expect(match.gaps).toBeInstanceOf(Array)
        expect(match.recommendations).toBeInstanceOf(Array)
      })

      it('validates UUID format', async () => {
        const result = await executeTool(client, 'analyze_match', {
          id: 'bad-id',
        })

        expect(result.content[0].text).toContain('Error')
      })
    })

    describe('get_tailored_profile', () => {
      it('returns tailored profile for opportunity', async () => {
        const testOpp = createTestOpportunity()
        const testTailored = createTestTailoredProfile({ opportunity_id: testOpp.id })
        mockFetch = createMockFetch({
          opportunities: [testOpp],
          tailoredProfiles: new Map([[testOpp.id, testTailored]]),
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const result = await executeTool(client, 'get_tailored_profile', {
          id: testOpp.id,
        })

        const profile = JSON.parse(result.content[0].text)
        expect(profile.opportunity_id).toBe(testOpp.id)
        expect(profile.summary).toBeDefined()
        expect(profile.skills).toBeInstanceOf(Array)
      })

      it('includes tailored experience highlights', async () => {
        const testOpp = createTestOpportunity()
        const testTailored = createTestTailoredProfile({ opportunity_id: testOpp.id })
        mockFetch = createMockFetch({
          opportunities: [testOpp],
          tailoredProfiles: new Map([[testOpp.id, testTailored]]),
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const result = await executeTool(client, 'get_tailored_profile', {
          id: testOpp.id,
        })

        const profile = JSON.parse(result.content[0].text)
        expect(profile.experience).toBeInstanceOf(Array)
      })
    })

    describe('create_share_link', () => {
      it('creates shareable link for tailored profile', async () => {
        const testOpp = createTestOpportunity()
        mockFetch = createMockFetch({ opportunities: [testOpp] })
        global.fetch = mockFetch as unknown as typeof fetch

        const result = await executeTool(client, 'create_share_link', {
          id: testOpp.id,
        })

        expect(result.content[0].text).toContain('Share link created')
        expect(result.content[0].text).toContain('https://idynic.com/share/')
      })

      it('includes expiration date in response', async () => {
        const testOpp = createTestOpportunity()
        mockFetch = createMockFetch({ opportunities: [testOpp] })
        global.fetch = mockFetch as unknown as typeof fetch

        const result = await executeTool(client, 'create_share_link', {
          id: testOpp.id,
        })

        expect(result.content[0].text).toContain('Expires:')
      })
    })
  })

  describe('Composite Tools', () => {
    describe('add_and_tailor', () => {
      it('adds opportunity and generates tailored profile', async () => {
        const result = await executeTool(client, 'add_and_tailor', {
          description:
            'Senior Software Engineer position at a fast-growing startup. We need someone with React and Node.js experience...',
        })

        expect(result.content[0].text).toContain('Completed')
        expect(result.content[0].text).toContain('Progress')
      })

      it('streams progress events', async () => {
        const result = await executeTool(client, 'add_and_tailor', {
          description: 'A'.repeat(100),
        })

        // Check for progress events in the response
        expect(result.content[0].text).toContain('Analyzing')
      })
    })

    describe('add_tailor_share', () => {
      it('adds opportunity, tailors, and creates share link', async () => {
        const result = await executeTool(client, 'add_tailor_share', {
          description:
            'Full Stack Developer role at an enterprise company. Must have experience with TypeScript and cloud services...',
        })

        expect(result.content[0].text).toContain('Completed')
      })

      it('validates minimum description length', async () => {
        const result = await executeTool(client, 'add_tailor_share', {
          description: 'Short',
        })

        expect(result.content[0].text).toContain('Error')
      })
    })
  })

  describe('Tool Registry', () => {
    it('has all expected tools registered', () => {
      const toolNames = tools.map((t) => t.name)
      expect(toolNames).toContain('get_profile')
      expect(toolNames).toContain('update_profile')
      expect(toolNames).toContain('get_claims')
      expect(toolNames).toContain('list_opportunities')
      expect(toolNames).toContain('get_opportunity')
      expect(toolNames).toContain('add_opportunity')
      expect(toolNames).toContain('analyze_match')
      expect(toolNames).toContain('get_tailored_profile')
      expect(toolNames).toContain('create_share_link')
      expect(toolNames).toContain('add_and_tailor')
      expect(toolNames).toContain('add_tailor_share')
    })

    it('all tools have valid input schemas', () => {
      tools.forEach((tool) => {
        expect(tool.inputSchema).toBeDefined()
        expect(tool.inputSchema.type).toBe('object')
        expect(Array.isArray(tool.inputSchema.required)).toBe(true)
      })
    })

    it('returns error for unknown tool', async () => {
      const result = await executeTool(client, 'nonexistent_tool', {})

      expect(result.content[0].text).toContain('Unknown tool')
    })
  })
})
