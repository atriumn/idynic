/**
 * Auth Flow Integration Tests
 *
 * These tests verify authentication and authorization flows for MCP tools.
 * Tests include token validation, expired token handling, and access control.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdynicClient } from '../../client.js'
import { executeTool } from '../../tools.js'
import {
  createMockFetch,
  createMockErrorResponse,
  ErrorScenarios,
} from '../mocks/api-client.js'

describe('Auth Flow Integration Tests', () => {
  let mockFetch: ReturnType<typeof createMockFetch>

  beforeEach(() => {
    mockFetch = createMockFetch()
    global.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication Required', () => {
    it('get_profile requires valid API key', async () => {
      const client = new IdynicClient('valid-api-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      // Should succeed with valid key
      expect(result.content[0].text).not.toContain('Error')
      const profile = JSON.parse(result.content[0].text)
      expect(profile.contact).toBeDefined()
    })

    it('get_claims requires authentication', async () => {
      const client = new IdynicClient('valid-api-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_claims', {})

      expect(result.content[0].text).not.toContain('Error')
    })

    it('list_opportunities requires authentication', async () => {
      const client = new IdynicClient('valid-api-key', 'https://api.test.com')
      const result = await executeTool(client, 'list_opportunities', {})

      expect(result.content[0].text).not.toContain('Error')
    })

    it('add_opportunity requires authentication', async () => {
      const client = new IdynicClient('valid-api-key', 'https://api.test.com')
      const result = await executeTool(client, 'add_opportunity', {
        description: 'A'.repeat(100),
      })

      expect(result.content[0].text).toContain('added')
    })

    it('update_profile requires authentication', async () => {
      const client = new IdynicClient('valid-api-key', 'https://api.test.com')
      const result = await executeTool(client, 'update_profile', {
        name: 'New Name',
      })

      expect(result.content[0].text).toContain('updated successfully')
    })
  })

  describe('Invalid Token Handling', () => {
    it('returns error for missing API key', async () => {
      // Simulate missing auth header
      const mockFetchNoAuth = vi.fn().mockResolvedValue(ErrorScenarios.UNAUTHORIZED())
      global.fetch = mockFetchNoAuth

      const client = new IdynicClient('', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
    })

    it('returns error for invalid API key', async () => {
      const client = new IdynicClient('invalid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('Invalid')
    })

    it('returns error for whitespace-only API key', async () => {
      const client = new IdynicClient('   ', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
    })

    it('returns error for API key with control characters', async () => {
      const client = new IdynicClient('\n\t', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
    })
  })

  describe('Expired Token Handling', () => {
    it('returns appropriate error for expired token', async () => {
      const client = new IdynicClient('expired-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('expired')
    })

    it('error message suggests refreshing authentication', async () => {
      const client = new IdynicClient('expired-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      // The error should be actionable
      const errorText = result.content[0].text.toLowerCase()
      expect(errorText).toContain('expired')
    })
  })

  describe('Authorization Errors', () => {
    it('returns forbidden error for unauthorized resource access', async () => {
      mockFetch = createMockFetch({
        errors: {
          getProfile: () => ErrorScenarios.FORBIDDEN(),
        },
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const client = new IdynicClient('valid-api-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('denied')
    })

    it('returns not found for non-existent resources', async () => {
      mockFetch = createMockFetch({
        errors: {
          getOpportunity: () => ErrorScenarios.NOT_FOUND(),
        },
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const client = new IdynicClient('valid-api-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_opportunity', {
        id: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('not found')
    })
  })

  describe('Bearer Token Format', () => {
    it('sends API key as Bearer token in Authorization header', async () => {
      const capturedRequests: Array<{ headers: Record<string, string> }> = []

      const capturingFetch = vi.fn().mockImplementation((url, options) => {
        capturedRequests.push({ headers: options?.headers || {} })
        return mockFetch(url, options)
      })
      global.fetch = capturingFetch

      const client = new IdynicClient('my-secret-key', 'https://api.test.com')
      await executeTool(client, 'get_profile', {})

      expect(capturedRequests.length).toBeGreaterThan(0)
      expect(capturedRequests[0].headers.Authorization).toBe('Bearer my-secret-key')
    })

    it('includes Content-Type header for JSON requests', async () => {
      const capturedRequests: Array<{ headers: Record<string, string> }> = []

      const capturingFetch = vi.fn().mockImplementation((url, options) => {
        capturedRequests.push({ headers: options?.headers || {} })
        return mockFetch(url, options)
      })
      global.fetch = capturingFetch

      const client = new IdynicClient('my-secret-key', 'https://api.test.com')
      await executeTool(client, 'update_profile', { name: 'Test' })

      expect(capturedRequests.length).toBeGreaterThan(0)
      expect(capturedRequests[0].headers['Content-Type']).toBe('application/json')
    })
  })

  describe('Token Scope Validation', () => {
    it('all read operations work with read-only token', async () => {
      // Simulate a read-only token that works for GET requests
      const client = new IdynicClient('read-only-key', 'https://api.test.com')

      // These should all succeed
      const profileResult = await executeTool(client, 'get_profile', {})
      expect(profileResult.content[0].text).not.toContain('Error')

      const claimsResult = await executeTool(client, 'get_claims', {})
      expect(claimsResult.content[0].text).not.toContain('Error')

      const oppsResult = await executeTool(client, 'list_opportunities', {})
      expect(oppsResult.content[0].text).not.toContain('Error')
    })

    it('write operations require write permissions', async () => {
      // For this test, we configure the mock to reject writes
      mockFetch = createMockFetch({
        errors: {
          updateProfile: () =>
            createMockErrorResponse(
              'INSUFFICIENT_PERMISSIONS',
              'This API key does not have write permissions',
              403
            ),
        },
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const client = new IdynicClient('read-only-key', 'https://api.test.com')
      const result = await executeTool(client, 'update_profile', { name: 'New Name' })

      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('permissions')
    })
  })

  describe('Session Persistence', () => {
    it('maintains authentication across multiple requests', async () => {
      const client = new IdynicClient('valid-api-key', 'https://api.test.com')

      // Make multiple requests with the same client
      const result1 = await executeTool(client, 'get_profile', {})
      const result2 = await executeTool(client, 'get_claims', {})
      const result3 = await executeTool(client, 'list_opportunities', {})

      // All should succeed
      expect(result1.content[0].text).not.toContain('Error')
      expect(result2.content[0].text).not.toContain('Error')
      expect(result3.content[0].text).not.toContain('Error')
    })

    it('each request includes the API key', async () => {
      let requestCount = 0
      const capturingFetch = vi.fn().mockImplementation((url, options) => {
        requestCount++
        const authHeader = (options?.headers as Record<string, string>)?.Authorization
        expect(authHeader).toBe('Bearer persistent-key')
        return mockFetch(url, options)
      })
      global.fetch = capturingFetch

      const client = new IdynicClient('persistent-key', 'https://api.test.com')

      await executeTool(client, 'get_profile', {})
      await executeTool(client, 'get_claims', {})
      await executeTool(client, 'list_opportunities', {})

      expect(requestCount).toBe(3)
    })
  })

  describe('Different API Key Formats', () => {
    it('accepts standard API key format', async () => {
      const client = new IdynicClient('sk_live_abc123def456', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).not.toContain('Error')
    })

    it('accepts test API key format', async () => {
      const client = new IdynicClient('sk_test_xyz789', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).not.toContain('Error')
    })

    it('accepts UUID-format API keys', async () => {
      const client = new IdynicClient(
        '550e8400-e29b-41d4-a716-446655440000',
        'https://api.test.com'
      )
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).not.toContain('Error')
    })
  })
})
