import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tools, executeTool } from './tools.js'
import type { IdynicClient } from './client.js'

describe('tools', () => {
  it('exports an array of tool definitions', () => {
    expect(Array.isArray(tools)).toBe(true)
    expect(tools.length).toBeGreaterThan(0)
  })

  it('each tool has required properties', () => {
    tools.forEach((tool) => {
      expect(tool.name).toBeDefined()
      expect(typeof tool.name).toBe('string')
      expect(tool.description).toBeDefined()
      expect(typeof tool.description).toBe('string')
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
      expect(Array.isArray(tool.inputSchema.required)).toBe(true)
    })
  })

  it('has unique tool names', () => {
    const names = tools.map((t) => t.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(names.length)
  })

  it('includes expected tools', () => {
    const names = tools.map((t) => t.name)
    expect(names).toContain('get_profile')
    expect(names).toContain('update_profile')
    expect(names).toContain('get_claims')
    expect(names).toContain('list_opportunities')
    expect(names).toContain('get_opportunity')
    expect(names).toContain('add_opportunity')
    expect(names).toContain('analyze_match')
    expect(names).toContain('get_tailored_profile')
    expect(names).toContain('create_share_link')
  })
})

describe('executeTool', () => {
  const mockClient: IdynicClient = {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getClaims: vi.fn(),
    listOpportunities: vi.fn(),
    getOpportunity: vi.fn(),
    addOpportunity: vi.fn(),
    getMatch: vi.fn(),
    getTailoredProfile: vi.fn(),
    createShareLink: vi.fn(),
    addAndTailor: vi.fn(),
    addTailorShare: vi.fn(),
  } as unknown as IdynicClient

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('get_profile', () => {
    it('returns profile data', async () => {
      const profileData = { contact: { name: 'Test User' } }
      vi.mocked(mockClient.getProfile).mockResolvedValue(profileData as never)

      const result = await executeTool(mockClient, 'get_profile', {})

      expect(mockClient.getProfile).toHaveBeenCalled()
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Test User')
    })
  })

  describe('update_profile', () => {
    it('updates profile with valid data', async () => {
      const updatedProfile = { contact: { name: 'Updated User' } }
      vi.mocked(mockClient.updateProfile).mockResolvedValue(updatedProfile as never)

      const result = await executeTool(mockClient, 'update_profile', {
        name: 'Updated User',
      })

      expect(mockClient.updateProfile).toHaveBeenCalledWith({ name: 'Updated User' })
      expect(result.content[0].text).toContain('updated successfully')
    })

    it('validates email format', async () => {
      const result = await executeTool(mockClient, 'update_profile', {
        email: 'invalid-email',
      })

      expect(result.content[0].text).toContain('Error')
      expect(mockClient.updateProfile).not.toHaveBeenCalled()
    })
  })

  describe('get_claims', () => {
    it('returns claims data', async () => {
      const claims = [{ id: '1', type: 'skill', label: 'TypeScript', confidence: 0.9 }]
      vi.mocked(mockClient.getClaims).mockResolvedValue(claims as never)

      const result = await executeTool(mockClient, 'get_claims', {})

      expect(mockClient.getClaims).toHaveBeenCalled()
      expect(result.content[0].text).toContain('TypeScript')
    })
  })

  describe('list_opportunities', () => {
    it('lists all opportunities without filter', async () => {
      const opportunities = [{ id: '1', title: 'Software Engineer' }]
      vi.mocked(mockClient.listOpportunities).mockResolvedValue(opportunities as never)

      const result = await executeTool(mockClient, 'list_opportunities', {})

      expect(mockClient.listOpportunities).toHaveBeenCalledWith(undefined)
      expect(result.content[0].text).toContain('Software Engineer')
    })

    it('filters by status', async () => {
      vi.mocked(mockClient.listOpportunities).mockResolvedValue([] as never)

      await executeTool(mockClient, 'list_opportunities', { status: 'applied' })

      expect(mockClient.listOpportunities).toHaveBeenCalledWith('applied')
    })
  })

  describe('get_opportunity', () => {
    it('gets opportunity by id', async () => {
      const opportunity = { id: '123', title: 'Product Manager' }
      vi.mocked(mockClient.getOpportunity).mockResolvedValue(opportunity as never)

      const result = await executeTool(mockClient, 'get_opportunity', {
        id: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(mockClient.getOpportunity).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')
      expect(result.content[0].text).toContain('Product Manager')
    })

    it('validates uuid format', async () => {
      const result = await executeTool(mockClient, 'get_opportunity', {
        id: 'invalid-id',
      })

      expect(result.content[0].text).toContain('Error')
      expect(mockClient.getOpportunity).not.toHaveBeenCalled()
    })
  })

  describe('add_opportunity', () => {
    it('adds opportunity with description', async () => {
      const newOpportunity = { id: '123', title: 'New Role' }
      vi.mocked(mockClient.addOpportunity).mockResolvedValue(newOpportunity as never)

      const longDescription = 'A'.repeat(100)
      const result = await executeTool(mockClient, 'add_opportunity', {
        description: longDescription,
      })

      expect(mockClient.addOpportunity).toHaveBeenCalledWith({
        description: longDescription,
      })
      expect(result.content[0].text).toContain('added')
    })

    it('validates minimum description length', async () => {
      const result = await executeTool(mockClient, 'add_opportunity', {
        description: 'Too short',
      })

      expect(result.content[0].text).toContain('Error')
      expect(mockClient.addOpportunity).not.toHaveBeenCalled()
    })

    it('accepts optional url', async () => {
      const newOpportunity = { id: '123', title: 'New Role' }
      vi.mocked(mockClient.addOpportunity).mockResolvedValue(newOpportunity as never)

      const longDescription = 'A'.repeat(100)
      await executeTool(mockClient, 'add_opportunity', {
        url: 'https://jobs.example.com/123',
        description: longDescription,
      })

      expect(mockClient.addOpportunity).toHaveBeenCalledWith({
        url: 'https://jobs.example.com/123',
        description: longDescription,
      })
    })
  })

  describe('analyze_match', () => {
    it('gets match analysis for opportunity', async () => {
      const matchData = {
        score: 85,
        strengths: ['TypeScript'],
        gaps: ['Python'],
        recommendations: ['Learn Python'],
      }
      vi.mocked(mockClient.getMatch).mockResolvedValue(matchData as never)

      const result = await executeTool(mockClient, 'analyze_match', {
        id: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(mockClient.getMatch).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')
      expect(result.content[0].text).toContain('TypeScript')
    })
  })

  describe('create_share_link', () => {
    it('creates share link for opportunity', async () => {
      const shareLink = {
        token: 'abc123',
        url: 'https://idynic.com/share/abc123',
        expires_at: '2025-12-31',
      }
      vi.mocked(mockClient.createShareLink).mockResolvedValue(shareLink as never)

      const result = await executeTool(mockClient, 'create_share_link', {
        id: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(mockClient.createShareLink).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')
      expect(result.content[0].text).toContain('https://idynic.com/share/abc123')
      expect(result.content[0].text).toContain('2025-12-31')
    })
  })

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = await executeTool(mockClient, 'unknown_tool', {})

      expect(result.content[0].text).toContain('Unknown tool')
    })
  })

  describe('error handling', () => {
    it('catches and returns API errors', async () => {
      vi.mocked(mockClient.getProfile).mockRejectedValue(new Error('API rate limit exceeded'))

      const result = await executeTool(mockClient, 'get_profile', {})

      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('API rate limit exceeded')
    })
  })
})
