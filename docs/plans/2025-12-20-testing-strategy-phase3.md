# Testing Strategy Phase 3: API Surface

> **Status:** ✅ COMPLETE (2025-12-20)

**Goal:** Achieve 80% coverage on all API routes and SSE streaming.

**Results:**
- 97 API route tests passing (232 total across all phases)
- lib/api: 87.87% statements, 89.23% lines
- lib/sse: 85% statements, 85% lines
- All major API endpoints tested:
  - Profile API (17 tests)
  - Opportunities API (18 tests)
  - Match endpoint (8 tests)
  - Tailor endpoint (10 tests)
  - Resume upload (7 tests)
  - Story upload (9 tests)
  - Share links (9 tests)
  - SSE streaming (19 tests)

**Architecture:** Test API routes as HTTP endpoints, mock Supabase and OpenAI, test SSE streaming reliability, validate request/response contracts.

**Tech Stack:** Vitest, Next.js test utilities, mock factories from Phase 1

**Design Document:** `docs/plans/2025-12-20-testing-strategy-design.md`

**Prerequisite:** Phase 1, Phase 2 complete

---

## Task 1: Create API Test Utilities

**Files:**
- Create: `src/__tests__/utils/api-test-helpers.ts`

**Step 1: Create helper functions**

```typescript
import { NextRequest } from 'next/server'
import { vi } from 'vitest'

export function createMockRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: unknown
    searchParams?: Record<string, string>
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body, searchParams = {} } = options

  const urlWithParams = new URL(url, 'http://localhost:3000')
  Object.entries(searchParams).forEach(([key, value]) => {
    urlWithParams.searchParams.set(key, value)
  })

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }

  if (body && method !== 'GET') {
    requestInit.body = JSON.stringify(body)
  }

  return new NextRequest(urlWithParams, requestInit)
}

export function createAuthenticatedRequest(
  url: string,
  apiKey: string,
  options: Parameters<typeof createMockRequest>[1] = {}
): NextRequest {
  return createMockRequest(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${apiKey}`
    }
  })
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  return JSON.parse(text) as T
}

export async function parseSSEResponse(response: Response): Promise<string[]> {
  const reader = response.body?.getReader()
  if (!reader) return []

  const decoder = new TextDecoder()
  const events: string[] = []
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        events.push(line.slice(6))
      }
    }
  }

  return events
}
```

**Step 2: Commit**

```bash
mkdir -p src/__tests__/utils
git add src/__tests__/utils/api-test-helpers.ts
git commit -m "test: add API test utilities"
```

---

## Task 2: Test SSE Streaming Module

**Files:**
- Create: `src/__tests__/unit/lib/sse/stream.test.ts`

**Step 1: Read the SSE module**

Read `src/lib/sse/stream.ts` and `src/lib/sse/types.ts`.

**Step 2: Create tests**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createSSEStream, sendSSEEvent, SSEEventType } from '@/lib/sse/stream'

describe('lib/sse/stream', () => {
  describe('createSSEStream', () => {
    it('returns a readable stream and writer', () => {
      const { stream, writer } = createSSEStream()

      expect(stream).toBeInstanceOf(ReadableStream)
      expect(writer).toBeDefined()
      expect(typeof writer.write).toBe('function')
      expect(typeof writer.close).toBe('function')
    })

    it('stream can be read after writing', async () => {
      const { stream, writer } = createSSEStream()

      writer.write('data: test\n\n')
      writer.close()

      const reader = stream.getReader()
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)

      expect(text).toContain('test')
    })
  })

  describe('sendSSEEvent', () => {
    it('formats phase events correctly', () => {
      const mockWriter = { write: vi.fn() }
      sendSSEEvent(mockWriter, 'phase', { phase: 'extracting', message: 'Processing...' })

      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"phase"')
      )
    })

    it('formats progress events with percentage', () => {
      const mockWriter = { write: vi.fn() }
      sendSSEEvent(mockWriter, 'progress', { progress: 50, message: 'Halfway' })

      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.stringContaining('"progress":50')
      )
    })

    it('formats error events', () => {
      const mockWriter = { write: vi.fn() }
      sendSSEEvent(mockWriter, 'error', { error: 'Something failed' })

      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      )
    })

    it('formats done events', () => {
      const mockWriter = { write: vi.fn() }
      sendSSEEvent(mockWriter, 'done', { result: { id: '123' } })

      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"done"')
      )
    })

    it('includes newlines for SSE format', () => {
      const mockWriter = { write: vi.fn() }
      sendSSEEvent(mockWriter, 'phase', { phase: 'test' })

      const written = mockWriter.write.mock.calls[0][0]
      expect(written).toMatch(/^data: .*\n\n$/)
    })
  })
})
```

**Step 3: Run tests**

```bash
pnpm test stream
```

**Step 4: Commit**

```bash
mkdir -p src/__tests__/unit/lib/sse
git add src/__tests__/unit/lib/sse/stream.test.ts
git commit -m "test: add SSE streaming tests"
```

---

## Task 3: Test Profile API Route

**Files:**
- Create: `src/__tests__/unit/app/api/v1/profile/route.test.ts`

**Step 1: Read the profile route**

Read `src/app/api/v1/profile/route.ts`.

**Step 2: Create tests**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/v1/profile/route'
import { createAuthenticatedRequest, parseJsonResponse } from '@/__tests__/utils/api-test-helpers'
import { createMockSupabaseClient } from '@/__mocks__/supabase'

vi.mock('@/lib/supabase/service-role')
vi.mock('@/lib/api/auth')

describe('GET /api/v1/profile', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>

  beforeEach(async () => {
    vi.resetModules()
    mockSupabase = createMockSupabaseClient()

    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    vi.mocked(createServiceRoleClient).mockReturnValue(mockSupabase as any)

    const { validateApiKey } = await import('@/lib/api/auth')
    vi.mocked(validateApiKey).mockResolvedValue({
      valid: true,
      userId: 'user-123'
    })
  })

  it('returns profile for valid API key', async () => {
    mockSupabase.__setMockData({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    })

    const request = createAuthenticatedRequest('/api/v1/profile', 'idn_validkey123')
    const response = await GET(request)
    const body = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(body.data.email).toBe('test@example.com')
  })

  it('returns 401 for missing API key', async () => {
    const { validateApiKey } = await import('@/lib/api/auth')
    vi.mocked(validateApiKey).mockResolvedValue({
      valid: false,
      error: 'API key required'
    })

    const request = createMockRequest('/api/v1/profile')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('returns 401 for invalid API key', async () => {
    const { validateApiKey } = await import('@/lib/api/auth')
    vi.mocked(validateApiKey).mockResolvedValue({
      valid: false,
      error: 'Invalid API key'
    })

    const request = createAuthenticatedRequest('/api/v1/profile', 'idn_invalid')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('returns 404 when profile not found', async () => {
    mockSupabase.__setMockData(null)

    const request = createAuthenticatedRequest('/api/v1/profile', 'idn_validkey123')
    const response = await GET(request)

    expect(response.status).toBe(404)
  })

  it('includes request_id in response meta', async () => {
    mockSupabase.__setMockData({ id: 'user-123' })

    const request = createAuthenticatedRequest('/api/v1/profile', 'idn_validkey123')
    const response = await GET(request)
    const body = await parseJsonResponse(response)

    expect(body.meta.request_id).toBeDefined()
  })
})
```

**Step 3: Run tests**

```bash
pnpm test profile/route
```

**Step 4: Commit**

```bash
mkdir -p src/__tests__/unit/app/api/v1/profile
git add src/__tests__/unit/app/api/v1/profile/route.test.ts
git commit -m "test: add profile API route tests"
```

---

## Task 4: Test Opportunities API Routes

**Files:**
- Create: `src/__tests__/unit/app/api/v1/opportunities/route.test.ts`
- Create: `src/__tests__/unit/app/api/v1/opportunities/[id]/route.test.ts`

Key test cases:
- GET /opportunities - Lists opportunities with pagination
- POST /opportunities - Creates new opportunity
- GET /opportunities/[id] - Returns single opportunity
- DELETE /opportunities/[id] - Deletes opportunity
- Validates request body
- Handles database errors
- Rate limiting applied

**Step 1: Create tests for each route**

**Step 2: Commit**

```bash
mkdir -p src/__tests__/unit/app/api/v1/opportunities
git add src/__tests__/unit/app/api/v1/opportunities/
git commit -m "test: add opportunities API route tests"
```

---

## Task 5: Test Match and Tailor Endpoints

**Files:**
- Create: `src/__tests__/unit/app/api/v1/opportunities/[id]/match/route.test.ts`
- Create: `src/__tests__/unit/app/api/v1/opportunities/[id]/tailor/route.test.ts`

Key test cases:
- Match endpoint returns scores and gaps
- Tailor endpoint streams SSE events
- Handles missing opportunity
- Applies AI rate limiting
- Returns proper error responses

**Step 1: Create tests**

**Step 2: Commit**

```bash
git add src/__tests__/unit/app/api/v1/opportunities/[id]/
git commit -m "test: add match and tailor endpoint tests"
```

---

## Task 6: Test Document Upload Endpoints

**Files:**
- Create: `src/__tests__/unit/app/api/v1/documents/resume/route.test.ts`
- Create: `src/__tests__/unit/app/api/v1/documents/story/route.test.ts`

Key test cases:
- Accepts valid file upload
- Validates file type
- Validates file size
- Streams processing progress
- Handles extraction errors
- Returns extracted data on completion

**Step 1: Create tests**

**Step 2: Commit**

```bash
mkdir -p src/__tests__/unit/app/api/v1/documents
git add src/__tests__/unit/app/api/v1/documents/
git commit -m "test: add document upload endpoint tests"
```

---

## Task 7: Test Compound Operation Endpoints

**Files:**
- Create: `src/__tests__/unit/app/api/v1/opportunities/add-and-tailor/route.test.ts`
- Create: `src/__tests__/unit/app/api/v1/opportunities/add-tailor-share/route.test.ts`

Key test cases:
- Performs all operations in sequence
- Streams progress for each phase
- Rolls back on failure
- Returns final result with share link

**Step 1: Create tests**

**Step 2: Commit**

```bash
git add src/__tests__/unit/app/api/v1/opportunities/
git commit -m "test: add compound operation endpoint tests"
```

---

## Task 8: Test Share Link Endpoints

**Files:**
- Create: `src/__tests__/unit/app/api/v1/shared/[token]/route.test.ts`
- Create: `src/__tests__/unit/app/api/v1/shared/[token]/summary/route.test.ts`

Key test cases:
- Returns profile for valid token
- Returns 404 for invalid token
- Returns 410 for expired token
- Returns 403 for revoked token
- Tracks view analytics

**Step 1: Create tests**

**Step 2: Commit**

```bash
mkdir -p src/__tests__/unit/app/api/v1/shared
git add src/__tests__/unit/app/api/v1/shared/
git commit -m "test: add share link endpoint tests"
```

---

## Task 9: Test Work History Endpoints

**Files:**
- Create: `src/__tests__/unit/app/api/v1/profile/work-history/route.test.ts`
- Create: `src/__tests__/unit/app/api/v1/profile/work-history/[id]/route.test.ts`

Key test cases:
- GET returns work history entries
- POST creates new entry
- GET [id] returns single entry
- DELETE [id] removes entry
- Validates date formats
- Handles concurrent modifications

**Step 1: Create tests**

**Step 2: Commit**

```bash
mkdir -p src/__tests__/unit/app/api/v1/profile/work-history
git add src/__tests__/unit/app/api/v1/profile/work-history/
git commit -m "test: add work history endpoint tests"
```

---

## Task 10: Run Coverage and Fill Gaps

**Step 1: Run coverage**

```bash
pnpm test:coverage
```

**Step 2: Review coverage for API routes**

Target: 80% for each route

**Step 3: Add tests for uncovered paths**

Common gaps:
- Error response formatting
- Edge cases in request parsing
- Rate limit exceeded responses
- Database error handling

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: complete Phase 3 - API surface tests at 80% coverage"
```

---

## Phase 3 Completion Checklist

- [x] API test utilities created
- [x] SSE streaming tests complete
- [x] Profile route tests complete
- [x] Opportunities routes tests complete
- [x] Match/tailor endpoints tests complete
- [x] Document upload tests complete
- [x] Compound operations tests complete
- [x] Share link tests complete
- [x] Work history tests complete
- [x] All API routes at 80%+ coverage
- [x] All tests pass

**Next:** Phase 4 - Integration Tests ⏭️ SKIPPED (low ROI)
