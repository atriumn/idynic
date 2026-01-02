/**
 * Mock API client for integration testing
 *
 * This module provides utilities for creating mock API responses
 * and simulating various API behaviors including errors.
 */

import type {
  ProfileData,
  Claim,
  Opportunity,
  MatchAnalysis,
  TailoredProfile,
  ShareLink,
  WorkHistoryEntry,
} from '../../client.js'

// Test data generators
export function createTestProfile(overrides: Partial<ProfileData> = {}): ProfileData {
  return {
    contact: {
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1-555-0100',
      location: 'San Francisco, CA',
      linkedin_url: 'https://linkedin.com/in/testuser',
      github_url: 'https://github.com/testuser',
      website_url: 'https://testuser.dev',
    },
    experience: [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        company: 'Test Company',
        title: 'Senior Software Engineer',
        start_date: '2022-01-01',
        end_date: null,
        summary: 'Building great software',
      },
    ],
    skills: [
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        type: 'skill',
        label: 'TypeScript',
        description: 'Strong proficiency in TypeScript',
        confidence: 0.95,
      },
    ],
    education: [
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        type: 'education',
        label: 'B.S. Computer Science',
        description: 'University of Test',
        confidence: 1.0,
      },
    ],
    certifications: [],
    ...overrides,
  }
}

export function createTestClaims(count = 3): Claim[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `550e8400-e29b-41d4-a716-44665544000${i}`,
    type: i % 2 === 0 ? 'skill' : 'achievement',
    label: `Claim ${i + 1}`,
    description: `Description for claim ${i + 1}`,
    confidence: 0.8 + Math.random() * 0.2,
  }))
}

export function createTestOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Senior Software Engineer',
    company: 'Tech Corp',
    url: 'https://jobs.example.com/123',
    status: 'tracking',
    match_score: 85,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

export function createTestOpportunities(count = 3): Opportunity[] {
  const statuses = ['tracking', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn']
  return Array.from({ length: count }, (_, i) => ({
    id: `550e8400-e29b-41d4-a716-44665544000${i}`,
    title: `Position ${i + 1}`,
    company: `Company ${i + 1}`,
    url: `https://jobs.example.com/${i}`,
    status: statuses[i % statuses.length],
    match_score: 70 + i * 5,
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
  }))
}

export function createTestMatchAnalysis(overrides: Partial<MatchAnalysis> = {}): MatchAnalysis {
  return {
    score: 85,
    strengths: [
      'Strong TypeScript experience',
      'React expertise',
      'Previous experience in similar role',
    ],
    gaps: ['Limited Go experience', 'No Kubernetes certification'],
    recommendations: [
      'Highlight React projects in your resume',
      'Consider obtaining Kubernetes certification',
      'Emphasize TypeScript skills',
    ],
    ...overrides,
  }
}

export function createTestTailoredProfile(
  overrides: Partial<TailoredProfile> = {}
): TailoredProfile {
  return {
    id: '550e8400-e29b-41d4-a716-446655440100',
    opportunity_id: '550e8400-e29b-41d4-a716-446655440000',
    summary:
      'Experienced software engineer with expertise in TypeScript and React, seeking to leverage skills in a new role.',
    experience: [
      {
        company: 'Test Company',
        title: 'Senior Software Engineer',
        highlights: ['Built React applications', 'Led TypeScript migration'],
      },
    ],
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

export function createTestShareLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    token: 'abc123def456',
    url: 'https://idynic.com/share/abc123def456',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

export function createTestWorkHistory(count = 2): WorkHistoryEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `550e8400-e29b-41d4-a716-44665544010${i}`,
    company: `Company ${i + 1}`,
    title: `Role ${i + 1}`,
    start_date: `202${i}-01-01`,
    end_date: i === 0 ? null : `202${i + 1}-01-01`,
    summary: `Summary of role ${i + 1}`,
  }))
}

// Mock fetch response helpers
export interface MockFetchOptions {
  status?: number
  headers?: Record<string, string>
  delay?: number
}

export function createMockResponse<T>(data: T, options: MockFetchOptions = {}): Response {
  const { status = 200, headers = {}, delay = 0 } = options

  const responseBody = JSON.stringify({ data })

  const response = new Response(responseBody, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  if (delay > 0) {
    // For delayed responses, we need to handle this at the fetch level
    ;(response as unknown as { _delay: number })._delay = delay
  }

  return response
}

export function createMockErrorResponse(
  code: string,
  message: string,
  status = 400
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        request_id: `req_${Date.now()}`,
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

// SSE stream helpers
export function createMockSSEStream(events: Array<{ type: string; data: unknown }>): Response {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []

  for (const event of events) {
    chunks.push(encoder.encode(`data: ${JSON.stringify(event.data)}\n\n`))
  }

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
    },
  })
}

// Error scenarios for testing
export const ErrorScenarios = {
  UNAUTHORIZED: () =>
    createMockErrorResponse('UNAUTHORIZED', 'Invalid or expired API key', 401),
  FORBIDDEN: () =>
    createMockErrorResponse('FORBIDDEN', 'Access denied to this resource', 403),
  NOT_FOUND: () => createMockErrorResponse('NOT_FOUND', 'Resource not found', 404),
  RATE_LIMITED: () =>
    createMockErrorResponse('RATE_LIMITED', 'Too many requests. Please try again later.', 429),
  VALIDATION_ERROR: (field: string) =>
    createMockErrorResponse('VALIDATION_ERROR', `Invalid value for field: ${field}`, 400),
  SERVER_ERROR: () =>
    createMockErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500),
  SERVICE_UNAVAILABLE: () =>
    createMockErrorResponse('SERVICE_UNAVAILABLE', 'Service temporarily unavailable', 503),
  NETWORK_ERROR: () => {
    throw new TypeError('Failed to fetch')
  },
  TIMEOUT_ERROR: () => {
    throw new DOMException('The operation was aborted.', 'AbortError')
  },
}

// Type for configurable mock client
export interface MockClientConfig {
  profile?: ProfileData
  claims?: Claim[]
  opportunities?: Opportunity[]
  matches?: Map<string, MatchAnalysis>
  tailoredProfiles?: Map<string, TailoredProfile>
  shareLinks?: Map<string, ShareLink>
  errors?: {
    getProfile?: () => Response
    updateProfile?: () => Response
    getClaims?: () => Response
    listOpportunities?: () => Response
    getOpportunity?: () => Response
    addOpportunity?: () => Response
    getMatch?: () => Response
    getTailoredProfile?: () => Response
    createShareLink?: () => Response
  }
}

/**
 * Creates a mock fetch function with configurable responses
 */
export function createMockFetch(config: MockClientConfig = {}) {
  const {
    profile = createTestProfile(),
    claims = createTestClaims(),
    opportunities = createTestOpportunities(),
    matches = new Map([['550e8400-e29b-41d4-a716-446655440000', createTestMatchAnalysis()]]),
    tailoredProfiles = new Map([
      ['550e8400-e29b-41d4-a716-446655440000', createTestTailoredProfile()],
    ]),
    shareLinks = new Map(),
    errors = {},
  } = config

  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlString = typeof url === 'string' ? url : url.toString()
    const method = init?.method || 'GET'

    // Check for auth header
    const authHeader = (init?.headers as Record<string, string>)?.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ErrorScenarios.UNAUTHORIZED()
    }

    const apiKey = authHeader.replace('Bearer ', '')
    if (apiKey === 'invalid-key') {
      return ErrorScenarios.UNAUTHORIZED()
    }
    if (apiKey === 'expired-key') {
      return createMockErrorResponse('TOKEN_EXPIRED', 'API key has expired', 401)
    }
    // Reject malformed keys (empty, whitespace-only, or containing control characters)
    if (!apiKey.trim() || /[\n\t\r]/.test(apiKey)) {
      return createMockErrorResponse('INVALID_API_KEY', 'Invalid API key format', 401)
    }

    // Route matching
    if (urlString.includes('/profile') && !urlString.includes('/work-history')) {
      if (errors.getProfile && method === 'GET') return errors.getProfile()
      if (errors.updateProfile && method === 'PATCH') return errors.updateProfile()
      return createMockResponse(profile)
    }

    if (urlString.includes('/claims')) {
      if (errors.getClaims) return errors.getClaims()
      return createMockResponse(claims)
    }

    if (urlString.includes('/opportunities')) {
      // Match analysis
      if (urlString.includes('/match')) {
        if (errors.getMatch) return errors.getMatch()
        const id = urlString.match(/opportunities\/([^/]+)\/match/)?.[1]
        const match = id ? matches.get(id) : null
        if (!match) return ErrorScenarios.NOT_FOUND()
        return createMockResponse(match)
      }

      // Tailored profile
      if (urlString.includes('/tailored-profile')) {
        if (errors.getTailoredProfile) return errors.getTailoredProfile()
        const id = urlString.match(/opportunities\/([^/]+)\/tailored-profile/)?.[1]
        const tailored = id ? tailoredProfiles.get(id) : null
        if (!tailored) return ErrorScenarios.NOT_FOUND()
        return createMockResponse(tailored)
      }

      // Share link
      if (urlString.includes('/share')) {
        if (errors.createShareLink) return errors.createShareLink()
        const id = urlString.match(/opportunities\/([^/]+)\/share/)?.[1]
        if (!id) return ErrorScenarios.NOT_FOUND()
        const newLink = createTestShareLink({ token: `share_${id}`, url: `https://idynic.com/share/share_${id}` })
        shareLinks.set(id, newLink)
        return createMockResponse(newLink)
      }

      // Add and tailor (SSE)
      if (urlString.includes('/add-and-tailor')) {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        const newOpp = createTestOpportunity({ title: 'New Opportunity', company: 'New Company' })
        return createMockSSEStream([
          { type: 'progress', data: { highlight: 'Analyzing job description...' } },
          { type: 'progress', data: { highlight: 'Creating opportunity...' } },
          { type: 'progress', data: { highlight: 'Generating tailored profile...' } },
          { type: 'done', data: { done: true, opportunity: newOpp } },
        ])
      }

      // Add, tailor, and share (SSE)
      if (urlString.includes('/add-tailor-share')) {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        const newOpp = createTestOpportunity({ title: 'New Opportunity' })
        const link = createTestShareLink()
        return createMockSSEStream([
          { type: 'progress', data: { highlight: 'Analyzing job description...' } },
          { type: 'progress', data: { highlight: 'Creating opportunity...' } },
          { type: 'progress', data: { highlight: 'Generating tailored profile...' } },
          { type: 'progress', data: { highlight: 'Creating share link...' } },
          { type: 'done', data: { done: true, opportunity: newOpp, share_link: link } },
        ])
      }

      // Single opportunity
      const idMatch = urlString.match(/opportunities\/([^/?]+)$/)
      if (idMatch && method === 'GET') {
        if (errors.getOpportunity) return errors.getOpportunity()
        const opp = opportunities.find((o) => o.id === idMatch[1])
        if (!opp) return ErrorScenarios.NOT_FOUND()
        return createMockResponse(opp)
      }

      // List or add opportunities
      if (method === 'POST') {
        if (errors.addOpportunity) return errors.addOpportunity()
        const body = init?.body ? JSON.parse(init.body as string) : {}
        const newOpp = createTestOpportunity({
          id: `550e8400-e29b-41d4-a716-${Date.now()}`,
          title: 'New Opportunity',
          url: body.url,
        })
        return createMockResponse(newOpp)
      }

      // List opportunities (with optional status filter)
      if (errors.listOpportunities) return errors.listOpportunities()
      const statusMatch = urlString.match(/status=(\w+)/)
      if (statusMatch) {
        const filtered = opportunities.filter((o) => o.status === statusMatch[1])
        return createMockResponse(filtered)
      }
      return createMockResponse(opportunities)
    }

    // Default: 404
    return ErrorScenarios.NOT_FOUND()
  }
}
