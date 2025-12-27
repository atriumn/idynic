import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient } from './client'

describe('createApiClient', () => {
  const mockFetch = vi.fn()
  const mockGetAuthToken = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
  })

  function createClient(baseUrl = 'https://api.example.com') {
    return createApiClient({
      baseUrl,
      getAuthToken: mockGetAuthToken,
    })
  }

  describe('fetchWithAuth', () => {
    it('adds Authorization header when token is available', async () => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      })

      const client = createClient()
      await client.profile.get()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/profile',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('does not add Authorization header when token is null', async () => {
      mockGetAuthToken.mockResolvedValue(null)
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      })

      const client = createClient()
      await client.profile.get()

      const callArgs = mockFetch.mock.calls[0]
      const headers = callArgs[1].headers as Record<string, string>
      expect(headers['Authorization']).toBeUndefined()
    })

    it('throws error with message from response', async () => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      })

      const client = createClient()
      await expect(client.profile.get()).rejects.toThrow('Unauthorized')
    })

    it('throws generic error when response has no message', async () => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      const client = createClient()
      await expect(client.profile.get()).rejects.toThrow('Request failed')
    })
  })

  describe('profile', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '123', name: 'Test User' }),
      })
    })

    it('get() fetches profile', async () => {
      const client = createClient()
      const result = await client.profile.get()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/profile',
        expect.any(Object)
      )
      expect(result).toEqual({ id: '123', name: 'Test User' })
    })

    it('update() sends PATCH request with data', async () => {
      const client = createClient()
      await client.profile.update({ name: 'Updated Name' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated Name' }),
        })
      )
    })
  })

  describe('opportunities', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
    })

    it('list() fetches all opportunities', async () => {
      const client = createClient()
      await client.opportunities.list()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/opportunities',
        expect.any(Object)
      )
    })

    it('get() fetches single opportunity by id', async () => {
      const client = createClient()
      await client.opportunities.get('opp-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/opportunities/opp-123',
        expect.any(Object)
      )
    })

    it('match() fetches match analysis', async () => {
      const client = createClient()
      await client.opportunities.match('opp-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/opportunities/opp-123/match',
        expect.any(Object)
      )
    })

    it('tailor() sends POST to tailor endpoint', async () => {
      const client = createClient()
      await client.opportunities.tailor('opp-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/opportunities/opp-123/tailor',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  describe('workHistory', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'wh-123' }),
      })
    })

    it('create() sends POST with work history data', async () => {
      const client = createClient()
      await client.workHistory.create({
        company: 'Acme Corp',
        title: 'Engineer',
        start_date: '2020-01-01',
        end_date: '2023-01-01',
        location: 'San Francisco, CA',
        summary: 'Built things',
        entry_type: 'work',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/profile/work-history',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Acme Corp'),
        })
      )
    })

    it('update() sends PATCH with partial data', async () => {
      const client = createClient()
      await client.workHistory.update('wh-123', { title: 'Senior Engineer' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/profile/work-history/wh-123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ title: 'Senior Engineer' }),
        })
      )
    })

    it('delete() sends DELETE request', async () => {
      const client = createClient()
      await client.workHistory.delete('wh-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/profile/work-history/wh-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('education', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'edu-123' }),
      })
    })

    it('create() sends POST with education text', async () => {
      const client = createClient()
      await client.education.create({ text: 'BS Computer Science, MIT' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/profile/education',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'BS Computer Science, MIT' }),
        })
      )
    })

    it('update() sends PATCH with updated text', async () => {
      const client = createClient()
      await client.education.update('edu-123', { text: 'MS Computer Science, MIT' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/profile/education/edu-123',
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })

    it('delete() sends DELETE request', async () => {
      const client = createClient()
      await client.education.delete('edu-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/profile/education/edu-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('skills', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'skill-123' }),
      })
    })

    it('create() sends POST with skill label', async () => {
      const client = createClient()
      await client.skills.create('TypeScript')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/profile/skills',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ label: 'TypeScript' }),
        })
      )
    })

    it('delete() sends DELETE request', async () => {
      const client = createClient()
      await client.skills.delete('skill-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/profile/skills/skill-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('sharedLinks', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
    })

    it('list() fetches all shared links', async () => {
      const client = createClient()
      await client.sharedLinks.list()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/shared-links',
        expect.any(Object)
      )
    })

    it('create() sends POST with link data', async () => {
      const client = createClient()
      await client.sharedLinks.create({ opportunity_id: 'opp-123' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/shared-links',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('delete() sends DELETE request', async () => {
      const client = createClient()
      await client.sharedLinks.delete('link-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/shared-links/link-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('claims', () => {
    beforeEach(() => {
      mockGetAuthToken.mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
    })

    it('list() fetches all claims', async () => {
      const client = createClient()
      await client.claims.list()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/claims',
        expect.any(Object)
      )
    })
  })
})
