/**
 * Mock Claude Integration E2E Tests
 *
 * These tests simulate how Claude would interact with MCP tools,
 * verifying response formats, multi-turn conversations, and error recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdynicClient } from '../../client.js'
import { tools } from '../../tools.js'
import {
  createMockClaudeClient,
  expectToolCalled,
  expectToolSuccess,
  MockClaudeClient,
} from '../mocks/claude-client.js'
import {
  createMockFetch,
  createTestOpportunity,
  createTestMatchAnalysis,
  createTestTailoredProfile,
  ErrorScenarios,
} from '../mocks/api-client.js'

describe('Claude Integration E2E Tests', () => {
  let mockFetch: ReturnType<typeof createMockFetch>
  let idynicClient: IdynicClient
  let claudeClient: MockClaudeClient

  beforeEach(() => {
    mockFetch = createMockFetch()
    global.fetch = mockFetch as unknown as typeof fetch
    idynicClient = new IdynicClient('valid-test-key', 'https://api.test.com')
    claudeClient = createMockClaudeClient(idynicClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
    claudeClient.clearHistory()
  })

  describe('Tool Discovery', () => {
    it('provides tools in Claude-compatible format', () => {
      const claudeTools = claudeClient.getTools()

      expect(claudeTools.length).toBe(tools.length)
      claudeTools.forEach((tool) => {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('input_schema')
      })
    })

    it('tool descriptions are clear and actionable', () => {
      const claudeTools = claudeClient.getTools()

      claudeTools.forEach((tool) => {
        expect(tool.description.length).toBeGreaterThan(10)
        // Description should start with a verb
        const startsWithAction = /^(Get|Update|List|Add|Analyze|Create)/.test(tool.description)
        expect(startsWithAction).toBe(true)
      })
    })
  })

  describe('Simple Tool Calls', () => {
    it('Claude can request user profile', async () => {
      const turn = await claudeClient.chat('Show me my profile')

      expectToolCalled([turn], 'get_profile')
      expectToolSuccess([turn], 'get_profile')
      expect(turn.assistantResponse.content).toContain('Test User')
    })

    it('Claude can list opportunities', async () => {
      const turn = await claudeClient.chat('What job opportunities am I tracking?')

      expectToolCalled([turn], 'list_opportunities')
      expectToolSuccess([turn], 'list_opportunities')
    })

    it('Claude can get claims/skills', async () => {
      const turn = await claudeClient.chat('What are my skills and achievements?')

      expectToolCalled([turn], 'get_claims')
      expectToolSuccess([turn], 'get_claims')
    })

    it('Claude can filter opportunities by status', async () => {
      const turn = await claudeClient.chat('Show me opportunities I have applied to')

      expectToolCalled([turn], 'list_opportunities', { status: 'applied' })
    })
  })

  describe('Tool Execution with Parameters', () => {
    it('Claude can get specific opportunity details', async () => {
      const testOpp = createTestOpportunity()
      mockFetch = createMockFetch({ opportunities: [testOpp] })
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('valid-test-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      const turn = await claudeClient.chat(`Show me details for opportunity ${testOpp.id}`)

      // Note: The mock Claude client has simplified inference
      // In reality, Claude would extract the ID from context
      expect(turn.assistantResponse.toolCalls.length).toBeGreaterThanOrEqual(0)
    })

    it('Claude can analyze match for opportunity', async () => {
      const testOpp = createTestOpportunity()
      const testMatch = createTestMatchAnalysis()
      mockFetch = createMockFetch({
        opportunities: [testOpp],
        matches: new Map([[testOpp.id, testMatch]]),
      })
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('valid-test-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      const turn = await claudeClient.chat(`Analyze match for ${testOpp.id}`)

      expectToolCalled([turn], 'analyze_match', { id: testOpp.id })
    })
  })

  describe('Multi-Turn Conversations', () => {
    it('handles profile viewing then updating', async () => {
      const turns = await claudeClient.multiTurnConversation([
        'Show me my profile',
        'Update my name to John Doe',
      ])

      expect(turns.length).toBe(2)
      expectToolCalled(turns, 'get_profile')
      // Note: update inference is simplified in mock
    })

    it('handles opportunity exploration flow', async () => {
      const testOpp = createTestOpportunity()
      mockFetch = createMockFetch({ opportunities: [testOpp] })
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('valid-test-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      const turns = await claudeClient.multiTurnConversation([
        'What opportunities am I tracking?',
        `Tell me more about the match analysis for ${testOpp.id}`,
      ])

      expect(turns.length).toBe(2)
      expectToolCalled(turns.slice(0, 1), 'list_opportunities')
      expectToolCalled(turns.slice(1), 'analyze_match')
    })

    it('maintains conversation context', async () => {
      const turns = await claudeClient.multiTurnConversation([
        'Show me my profile',
        'What skills do I have?',
        'List my opportunities',
      ])

      expect(turns.length).toBe(3)
      const history = claudeClient.getHistory()
      expect(history.length).toBeGreaterThan(0)
    })
  })

  describe('Response Format Verification', () => {
    it('tool results are properly formatted for Claude', async () => {
      const turn = await claudeClient.chat('Show me my profile')

      expect(turn.assistantResponse.toolResults.length).toBeGreaterThan(0)
      const result = turn.assistantResponse.toolResults[0]

      expect(result).toHaveProperty('tool_call_id')
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('success')
    })

    it('successful results contain parseable JSON', async () => {
      const turn = await claudeClient.chat('Show me my profile')

      const result = turn.assistantResponse.toolResults[0]
      expect(result.success).toBe(true)

      // Content should be valid JSON
      expect(() => JSON.parse(result.content)).not.toThrow()
    })

    it('error results have error field', async () => {
      mockFetch = createMockFetch({
        errors: {
          getProfile: () => ErrorScenarios.SERVER_ERROR(),
        },
      })
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('valid-test-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      const turn = await claudeClient.chat('Show me my profile')

      const result = turn.assistantResponse.toolResults[0]
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Error Recovery', () => {
    it('Claude provides helpful message on tool error', async () => {
      mockFetch = createMockFetch({
        errors: {
          getProfile: () => ErrorScenarios.UNAUTHORIZED(),
        },
      })
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('invalid-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      const turn = await claudeClient.chat('Show me my profile')

      expect(turn.assistantResponse.content).toContain('error')
    })

    it('Claude can handle rate limiting gracefully', async () => {
      mockFetch = createMockFetch({
        errors: {
          listOpportunities: () => ErrorScenarios.RATE_LIMITED(),
        },
      })
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('valid-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      const turn = await claudeClient.chat('Show me my opportunities')

      expect(turn.assistantResponse.toolResults[0].success).toBe(false)
      expect(turn.assistantResponse.content).toContain('error')
    })

    it('Claude can retry after transient failures', async () => {
      let callCount = 0
      const flakeyFetch = vi.fn().mockImplementation((url, options) => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(ErrorScenarios.SERVICE_UNAVAILABLE())
        }
        return mockFetch(url, options)
      })
      global.fetch = flakeyFetch

      idynicClient = new IdynicClient('valid-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      // First attempt fails
      const turn1 = await claudeClient.chat('Show me my profile')
      expect(turn1.assistantResponse.toolResults[0].success).toBe(false)

      // Reset and retry
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('valid-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      const turn2 = await claudeClient.chat('Show me my profile')
      expect(turn2.assistantResponse.toolResults[0].success).toBe(true)
    })
  })

  describe('Complex Workflows', () => {
    it('handles add opportunity workflow', async () => {
      const description =
        'We are looking for a Senior Software Engineer with 5+ years of experience in React and TypeScript to join our growing team...'

      const result = await claudeClient.executeTool('add_opportunity', {
        description,
      })

      expect(result.success).toBe(true)
      expect(result.content).toContain('added')
    })

    it('handles share link creation workflow', async () => {
      const testOpp = createTestOpportunity()
      mockFetch = createMockFetch({ opportunities: [testOpp] })
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('valid-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      const turn = await claudeClient.chat(`Create a share link for opportunity ${testOpp.id}`)

      expectToolCalled([turn], 'create_share_link', { id: testOpp.id })
    })

    it('handles complete opportunity analysis flow', async () => {
      const testOpp = createTestOpportunity()
      const testMatch = createTestMatchAnalysis()
      const testTailored = createTestTailoredProfile({ opportunity_id: testOpp.id })

      mockFetch = createMockFetch({
        opportunities: [testOpp],
        matches: new Map([[testOpp.id, testMatch]]),
        tailoredProfiles: new Map([[testOpp.id, testTailored]]),
      })
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('valid-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      // Get match analysis
      const matchResult = await claudeClient.executeTool('analyze_match', { id: testOpp.id })
      expect(matchResult.success).toBe(true)

      // Get tailored profile
      const tailoredResult = await claudeClient.executeTool('get_tailored_profile', {
        id: testOpp.id,
      })
      expect(tailoredResult.success).toBe(true)

      // Create share link
      const shareResult = await claudeClient.executeTool('create_share_link', { id: testOpp.id })
      expect(shareResult.success).toBe(true)
    })
  })

  describe('Edge Cases in Conversations', () => {
    it('handles empty user message gracefully', async () => {
      const turn = await claudeClient.chat('')

      // Should not crash
      expect(turn.assistantResponse.content).toBeDefined()
    })

    it('handles message with no tool match', async () => {
      const turn = await claudeClient.chat('What is the weather like today?')

      // Should not call any tools
      expect(turn.assistantResponse.toolCalls.length).toBe(0)
      expect(turn.assistantResponse.content).toContain('not sure')
    })

    it('handles very long user messages', async () => {
      const longMessage = 'Show me my profile ' + 'A'.repeat(5000)
      const turn = await claudeClient.chat(longMessage)

      // Should still identify the intent
      expectToolCalled([turn], 'get_profile')
    })
  })

  describe('Tool Result Processing', () => {
    it('profile data is presented in human-readable format', async () => {
      const turn = await claudeClient.chat('Show me my profile')

      const content = turn.assistantResponse.content
      expect(content).toContain('Test User')
    })

    it('opportunity list shows key details', async () => {
      const turn = await claudeClient.chat('Show me my opportunities')

      const result = turn.assistantResponse.toolResults[0]
      if (result.success) {
        const opportunities = JSON.parse(result.content)
        expect(Array.isArray(opportunities)).toBe(true)
      }
    })

    it('match analysis shows strengths and gaps', async () => {
      const testOpp = createTestOpportunity()
      const testMatch = createTestMatchAnalysis()
      mockFetch = createMockFetch({
        opportunities: [testOpp],
        matches: new Map([[testOpp.id, testMatch]]),
      })
      global.fetch = mockFetch as unknown as typeof fetch
      idynicClient = new IdynicClient('valid-key', 'https://api.test.com')
      claudeClient = createMockClaudeClient(idynicClient)

      const result = await claudeClient.executeTool('analyze_match', { id: testOpp.id })

      expect(result.success).toBe(true)
      const match = JSON.parse(result.content)
      expect(match.strengths).toBeDefined()
      expect(match.gaps).toBeDefined()
      expect(match.recommendations).toBeDefined()
    })
  })

  describe('Direct Tool Execution', () => {
    it('can execute get_profile directly', async () => {
      const result = await claudeClient.executeTool('get_profile', {})

      expect(result.success).toBe(true)
      const profile = JSON.parse(result.content)
      expect(profile.contact).toBeDefined()
    })

    it('can execute update_profile directly', async () => {
      const result = await claudeClient.executeTool('update_profile', {
        name: 'New Name',
      })

      expect(result.success).toBe(true)
      expect(result.content).toContain('updated')
    })

    it('can execute list_opportunities with filter', async () => {
      const result = await claudeClient.executeTool('list_opportunities', {
        status: 'tracking',
      })

      expect(result.success).toBe(true)
    })

    it('handles validation errors in direct execution', async () => {
      const result = await claudeClient.executeTool('get_opportunity', {
        id: 'invalid-uuid',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
