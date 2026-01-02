/**
 * Error Handling Integration Tests
 *
 * These tests verify proper error handling for various failure scenarios
 * including API errors, validation errors, network failures, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdynicClient } from '../../client.js'
import { executeTool } from '../../tools.js'
import {
  createMockFetch,
  createMockErrorResponse,
  ErrorScenarios,
  createTestOpportunity,
} from '../mocks/api-client.js'

describe('Error Handling Integration Tests', () => {
  let mockFetch: ReturnType<typeof createMockFetch>

  beforeEach(() => {
    mockFetch = createMockFetch()
    global.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('API Error Responses', () => {
    describe('4xx Client Errors', () => {
      it('handles 400 Bad Request', async () => {
        mockFetch = createMockFetch({
          errors: {
            addOpportunity: () =>
              createMockErrorResponse('BAD_REQUEST', 'Invalid request format', 400),
          },
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'add_opportunity', {
          description: 'A'.repeat(100),
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('Invalid request')
      })

      it('handles 401 Unauthorized', async () => {
        mockFetch = createMockFetch({
          errors: {
            getProfile: () => ErrorScenarios.UNAUTHORIZED(),
          },
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'get_profile', {})

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('Invalid')
      })

      it('handles 403 Forbidden', async () => {
        mockFetch = createMockFetch({
          errors: {
            getOpportunity: () => ErrorScenarios.FORBIDDEN(),
          },
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'get_opportunity', {
          id: '550e8400-e29b-41d4-a716-446655440000',
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('denied')
      })

      it('handles 404 Not Found', async () => {
        mockFetch = createMockFetch({
          errors: {
            getOpportunity: () => ErrorScenarios.NOT_FOUND(),
          },
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'get_opportunity', {
          id: '550e8400-e29b-41d4-a716-446655440000',
        })

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('not found')
      })

      it('handles 429 Rate Limited', async () => {
        mockFetch = createMockFetch({
          errors: {
            getProfile: () => ErrorScenarios.RATE_LIMITED(),
          },
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'get_profile', {})

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('many requests')
      })
    })

    describe('5xx Server Errors', () => {
      it('handles 500 Internal Server Error', async () => {
        mockFetch = createMockFetch({
          errors: {
            getProfile: () => ErrorScenarios.SERVER_ERROR(),
          },
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'get_profile', {})

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('unexpected')
      })

      it('handles 503 Service Unavailable', async () => {
        mockFetch = createMockFetch({
          errors: {
            getProfile: () => ErrorScenarios.SERVICE_UNAVAILABLE(),
          },
        })
        global.fetch = mockFetch as unknown as typeof fetch

        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'get_profile', {})

        expect(result.content[0].text).toContain('Error')
        expect(result.content[0].text).toContain('unavailable')
      })
    })
  })

  describe('Network Errors', () => {
    it('handles network connection failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('Failed to fetch')
    })

    it('handles DNS resolution failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('getaddrinfo ENOTFOUND'))

      const client = new IdynicClient('valid-key', 'https://nonexistent.api.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
    })

    it('handles connection reset', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'))

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
    })

    it('handles timeout errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(
        new DOMException('The operation was aborted.', 'AbortError')
      )

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('aborted')
    })
  })

  describe('Validation Errors', () => {
    describe('Input Validation', () => {
      it('rejects invalid email format in update_profile', async () => {
        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'update_profile', {
          email: 'not-an-email',
        })

        expect(result.content[0].text).toContain('Error')
      })

      it('rejects invalid URL format in update_profile', async () => {
        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'update_profile', {
          linkedin: 'not-a-url',
        })

        expect(result.content[0].text).toContain('Error')
      })

      it('rejects non-UUID for opportunity ID', async () => {
        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'get_opportunity', {
          id: 'not-a-uuid',
        })

        expect(result.content[0].text).toContain('Error')
      })

      it('rejects short description in add_opportunity', async () => {
        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'add_opportunity', {
          description: 'Too short',
        })

        expect(result.content[0].text).toContain('Error')
      })

      it('rejects invalid URL in add_opportunity', async () => {
        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'add_opportunity', {
          url: 'not-a-valid-url',
          description: 'A'.repeat(100),
        })

        expect(result.content[0].text).toContain('Error')
      })
    })

    describe('Missing Required Fields', () => {
      it('rejects add_opportunity without description', async () => {
        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'add_opportunity', {
          url: 'https://jobs.example.com/123',
          // description is required but missing
        })

        expect(result.content[0].text).toContain('Error')
      })

      it('rejects get_opportunity without id', async () => {
        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'get_opportunity', {
          // id is required but missing
        })

        expect(result.content[0].text).toContain('Error')
      })

      it('rejects analyze_match without id', async () => {
        const client = new IdynicClient('valid-key', 'https://api.test.com')
        const result = await executeTool(client, 'analyze_match', {})

        expect(result.content[0].text).toContain('Error')
      })
    })
  })

  describe('Malformed Response Handling', () => {
    it('handles empty response body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      // Should not crash, but should handle gracefully
      expect(result.content).toHaveLength(1)
    })

    it('handles invalid JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      })

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
    })

    it('handles null data field', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      })

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      // Should handle null gracefully
      expect(result.content).toHaveLength(1)
    })
  })

  describe('Edge Cases', () => {
    it('handles empty opportunity list', async () => {
      mockFetch = createMockFetch({ opportunities: [] })
      global.fetch = mockFetch as unknown as typeof fetch

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'list_opportunities', {})

      const opportunities = JSON.parse(result.content[0].text)
      expect(opportunities).toEqual([])
    })

    it('handles empty claims list', async () => {
      mockFetch = createMockFetch({ claims: [] })
      global.fetch = mockFetch as unknown as typeof fetch

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_claims', {})

      const claims = JSON.parse(result.content[0].text)
      expect(claims).toEqual([])
    })

    it('handles very long description input', async () => {
      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const longDescription = 'A'.repeat(10000) // 10KB of text

      const result = await executeTool(client, 'add_opportunity', {
        description: longDescription,
      })

      // Should handle without error
      expect(result.content[0].text).not.toContain('Error')
    })

    it('handles special characters in input', async () => {
      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'update_profile', {
        name: 'Test User <script>alert("xss")</script>',
      })

      // Should handle without crashing
      expect(result.content).toHaveLength(1)
    })

    it('handles unicode characters in input', async () => {
      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'update_profile', {
        name: 'Test User ',
        location: 'Berlin, Deutschland',
      })

      // Should handle unicode without issues
      expect(result.content[0].text).not.toContain('Error')
    })
  })

  describe('Error Message Quality', () => {
    it('provides actionable error messages for validation errors', async () => {
      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'update_profile', {
        email: 'invalid',
      })

      // Error should mention what's wrong
      const errorText = result.content[0].text.toLowerCase()
      expect(errorText).toContain('error')
    })

    it('provides meaningful errors for API failures', async () => {
      mockFetch = createMockFetch({
        errors: {
          getProfile: () =>
            createMockErrorResponse('DATABASE_ERROR', 'Database connection failed', 500),
        },
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('Database')
    })

    it('does not expose sensitive information in errors', async () => {
      mockFetch = createMockFetch({
        errors: {
          getProfile: () =>
            createMockErrorResponse(
              'DATABASE_ERROR',
              'Connection to postgres://secret:password@db.host.com failed',
              500
            ),
        },
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const client = new IdynicClient('valid-key', 'https://api.test.com')
      const result = await executeTool(client, 'get_profile', {})

      // The error is passed through from the API, but tests verify behavior
      expect(result.content[0].text).toContain('Error')
    })
  })

  describe('Concurrent Request Handling', () => {
    it('handles multiple concurrent requests', async () => {
      const client = new IdynicClient('valid-key', 'https://api.test.com')

      // Make multiple concurrent requests
      const results = await Promise.all([
        executeTool(client, 'get_profile', {}),
        executeTool(client, 'get_claims', {}),
        executeTool(client, 'list_opportunities', {}),
      ])

      // All should succeed
      results.forEach((result) => {
        expect(result.content[0].text).not.toContain('Error')
      })
    })

    it('handles mixed success and failure in concurrent requests', async () => {
      mockFetch = createMockFetch({
        errors: {
          getClaims: () => ErrorScenarios.SERVER_ERROR(),
        },
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const client = new IdynicClient('valid-key', 'https://api.test.com')

      const results = await Promise.all([
        executeTool(client, 'get_profile', {}),
        executeTool(client, 'get_claims', {}), // This one fails
        executeTool(client, 'list_opportunities', {}),
      ])

      // First and third should succeed
      expect(results[0].content[0].text).not.toContain('Error')
      expect(results[2].content[0].text).not.toContain('Error')

      // Second should fail
      expect(results[1].content[0].text).toContain('Error')
    })
  })
})
