import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IdynicClient } from './client.js'

describe('IdynicClient', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  function createSuccessResponse<T>(data: T) {
    return {
      ok: true,
      json: () => Promise.resolve({ data }),
    }
  }

  function createErrorResponse(code: string, message: string, status = 400) {
    return {
      ok: false,
      status,
      json: () => Promise.resolve({ error: { code, message } }),
    }
  }

  describe('constructor', () => {
    it('uses default base URL', () => {
      const client = new IdynicClient('test-api-key')
      expect(client).toBeDefined()
    })

    it('accepts custom base URL', () => {
      const client = new IdynicClient('test-api-key', 'https://custom.api.com')
      expect(client).toBeDefined()
    })
  })

  describe('request headers', () => {
    it('includes Authorization header with Bearer token', async () => {
      mockFetch.mockResolvedValue(createSuccessResponse({ contact: {} }))
      const client = new IdynicClient('my-api-key')

      await client.getProfile()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-api-key',
          }),
        })
      )
    })

    it('includes Content-Type header', async () => {
      mockFetch.mockResolvedValue(createSuccessResponse({ contact: {} }))
      const client = new IdynicClient('my-api-key')

      await client.getProfile()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })

  describe('getProfile', () => {
    it('fetches profile from correct endpoint', async () => {
      const profileData = { contact: { name: 'Test User' } }
      mockFetch.mockResolvedValue(createSuccessResponse(profileData))

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.getProfile()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/profile',
        expect.objectContaining({ method: 'GET' })
      )
      expect(result).toEqual(profileData)
    })
  })

  describe('updateProfile', () => {
    it('sends PATCH request with updates', async () => {
      mockFetch.mockResolvedValue(createSuccessResponse({ contact: { name: 'New Name' } }))

      const client = new IdynicClient('key', 'https://api.test.com')
      await client.updateProfile({ name: 'New Name' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'New Name' }),
        })
      )
    })
  })

  describe('getClaims', () => {
    it('fetches claims from correct endpoint', async () => {
      const claims = [{ id: '1', type: 'skill', label: 'JavaScript' }]
      mockFetch.mockResolvedValue(createSuccessResponse(claims))

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.getClaims()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/claims',
        expect.objectContaining({ method: 'GET' })
      )
      expect(result).toEqual(claims)
    })
  })

  describe('listOpportunities', () => {
    it('fetches opportunities without filter', async () => {
      mockFetch.mockResolvedValue(createSuccessResponse([]))

      const client = new IdynicClient('key', 'https://api.test.com')
      await client.listOpportunities()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities',
        expect.any(Object)
      )
    })

    it('includes status filter in query string', async () => {
      mockFetch.mockResolvedValue(createSuccessResponse([]))

      const client = new IdynicClient('key', 'https://api.test.com')
      await client.listOpportunities('applied')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities?status=applied',
        expect.any(Object)
      )
    })
  })

  describe('getOpportunity', () => {
    it('fetches opportunity by id', async () => {
      const opportunity = { id: '123', title: 'Engineer' }
      mockFetch.mockResolvedValue(createSuccessResponse(opportunity))

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.getOpportunity('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities/123',
        expect.any(Object)
      )
      expect(result).toEqual(opportunity)
    })
  })

  describe('addOpportunity', () => {
    it('sends POST request with opportunity data', async () => {
      const newOpp = { id: '456', title: 'Manager' }
      mockFetch.mockResolvedValue(createSuccessResponse(newOpp))

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.addOpportunity({
        url: 'https://jobs.com/123',
        description: 'Great opportunity',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            url: 'https://jobs.com/123',
            description: 'Great opportunity',
          }),
        })
      )
      expect(result).toEqual(newOpp)
    })
  })

  describe('getMatch', () => {
    it('fetches match analysis', async () => {
      const matchData = { score: 85, strengths: ['TypeScript'] }
      mockFetch.mockResolvedValue(createSuccessResponse(matchData))

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.getMatch('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities/123/match',
        expect.any(Object)
      )
      expect(result).toEqual(matchData)
    })
  })

  describe('getTailoredProfile', () => {
    it('fetches tailored profile', async () => {
      const tailored = { id: 't1', summary: 'Custom summary' }
      mockFetch.mockResolvedValue(createSuccessResponse(tailored))

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.getTailoredProfile('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities/123/tailored-profile',
        expect.any(Object)
      )
      expect(result).toEqual(tailored)
    })
  })

  describe('createShareLink', () => {
    it('creates share link', async () => {
      const link = { token: 'abc', url: 'https://idynic.com/share/abc' }
      mockFetch.mockResolvedValue(createSuccessResponse(link))

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.createShareLink('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities/123/share',
        expect.objectContaining({ method: 'POST' })
      )
      expect(result).toEqual(link)
    })
  })

  describe('SSE endpoints', () => {
    it('tailorProfile returns raw response', async () => {
      const mockResponse = { ok: true, body: {} }
      mockFetch.mockResolvedValue(mockResponse)

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.tailorProfile('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities/123/tailor',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer key' },
        })
      )
      expect(result).toBe(mockResponse)
    })

    it('addAndTailor sends description and returns raw response', async () => {
      const mockResponse = { ok: true, body: {} }
      mockFetch.mockResolvedValue(mockResponse)

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.addAndTailor({ description: 'Job desc' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities/add-and-tailor',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ description: 'Job desc' }),
        })
      )
      expect(result).toBe(mockResponse)
    })

    it('addTailorShare returns raw response', async () => {
      const mockResponse = { ok: true, body: {} }
      mockFetch.mockResolvedValue(mockResponse)

      const client = new IdynicClient('key', 'https://api.test.com')
      const result = await client.addTailorShare({
        url: 'https://jobs.com/1',
        description: 'Job desc',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/opportunities/add-tailor-share',
        expect.any(Object)
      )
      expect(result).toBe(mockResponse)
    })
  })

  describe('error handling', () => {
    it('throws error with API error message', async () => {
      mockFetch.mockResolvedValue(
        createErrorResponse('UNAUTHORIZED', 'Invalid API key', 401)
      )

      const client = new IdynicClient('bad-key', 'https://api.test.com')

      await expect(client.getProfile()).rejects.toThrow('Invalid API key')
    })

    it('throws generic error when no message provided', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })

      const client = new IdynicClient('key', 'https://api.test.com')

      await expect(client.getProfile()).rejects.toThrow('API error: 500')
    })
  })
})
