# Testing Strategy Design

**Date:** 2025-12-20
**Status:** Draft

## Overview

Establish comprehensive testing infrastructure for the Idynic platform. Currently there are **zero tests** in the codebase. This design prioritizes tests by business risk: security/cost control first, then AI extraction quality, then API surface, then integration, then UI.

## Current State

- **Test files:** 0
- **Test config:** None
- **CI/CD:** None
- **Coverage:** 0%

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Test Layers                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    E2E Tests (Playwright)                │    │
│  │         Login → Upload → Tailor → Share flows            │    │
│  │                   Coverage: 60%                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Integration Tests (Vitest)                  │    │
│  │      Real Supabase (local), RLS policies, migrations     │    │
│  │                   Coverage: 70%                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               API Route Tests (Vitest)                   │    │
│  │        Request/response validation, error handling       │    │
│  │                   Coverage: 80%                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Unit Tests (Vitest)                      │    │
│  │     Auth, rate limiting, AI extraction, utilities        │    │
│  │           Security: 100% | AI: 85% | Utils: 90%          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Priority Matrix

| Priority | Layer | Modules | Why | Coverage |
|----------|-------|---------|-----|----------|
| **P1** | Security | `/lib/api/auth.ts`, `/lib/api/rate-limit.ts`, `/lib/api/keys.ts` | Financial risk, data security | 100% |
| **P2** | AI Core | `/lib/ai/extract-*.ts`, `/lib/ai/embeddings.ts`, `/lib/ai/match-*.ts`, `/lib/ai/synthesize-*.ts` | Core product value | 85% |
| **P3** | API Surface | `/app/api/v1/**`, `/lib/sse/`, `/lib/api/response.ts` | Developer integration | 80% |
| **P4** | Database | Supabase clients, RLS policies | Data integrity | 70% (RLS: 100%) |
| **P5** | Components | React components, E2E flows | UI stability | 60% |

## Technology Decisions

### Test Framework: Vitest

**Why not Jest:**
- Vitest is ESM-native (Next.js 14 uses ESM)
- 10x faster cold start
- Native TypeScript support
- Compatible with Jest API (easy migration later)
- Built-in UI mode for debugging

### Component Testing: Testing Library

**Why:**
- Industry standard for React
- Tests user behavior, not implementation
- Accessible queries encourage a11y
- Works with Vitest

### E2E: Playwright

**Why not Cypress:**
- Better multi-browser support
- Faster execution
- Better TypeScript support
- Works with Next.js App Router

### Mocking: Vitest Built-in + MSW

**Strategy:**
- Mock OpenAI SDK for deterministic AI tests
- Mock Supabase client for unit tests
- Use real local Supabase for integration tests
- MSW for HTTP-level API mocking when needed

## Mocking Strategy

### OpenAI API

```typescript
// Unit tests: Mock the SDK
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"extracted": "data"}' } }]
        })
      }
    },
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    }
  }))
}))
```

### Supabase

```typescript
// Unit tests: Chainable mock
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: {...}, error: null })
}

// Integration tests: Real local Supabase
// supabase start → runs PostgreSQL locally
```

## Contract Testing

### OpenAI Contract

- Store example responses in `__fixtures__/openai/`
- Unit tests verify extraction logic handles these responses
- Quarterly manual validation against live API
- Monitor for breaking changes via response structure validation

### Supabase Contract

- RLS policies tested with actual Supabase (local)
- RPC function signatures validated in integration tests
- Migration tests verify schema changes don't break queries

## File Structure

```
src/
├── __mocks__/
│   ├── openai.ts           # OpenAI SDK mock factory
│   └── supabase.ts         # Supabase client mock factory
├── __fixtures__/
│   ├── resumes/            # Sample resume files
│   ├── opportunities/      # Sample job descriptions
│   └── openai/             # OpenAI response examples
├── __tests__/
│   ├── unit/
│   │   ├── lib/
│   │   │   ├── api/        # auth, rate-limit, keys, response
│   │   │   ├── ai/         # extraction, matching, generation
│   │   │   └── sse/        # streaming utilities
│   │   └── components/     # React component tests
│   ├── integration/
│   │   ├── api/            # Full API route tests
│   │   ├── db/             # Database + RLS tests
│   │   └── workflows/      # Multi-step flows
│   └── e2e/                # Playwright tests
├── vitest.config.ts        # Unit test config
├── vitest.integration.config.ts
└── playwright.config.ts
```

## Coverage Targets

| Layer | Target | Enforced In CI |
|-------|--------|----------------|
| Security (`/lib/api/auth.ts`, `rate-limit.ts`, `keys.ts`) | 100% | Yes, fail build |
| AI Core (`/lib/ai/`) | 85% | Yes, fail build |
| API Routes (`/app/api/v1/`) | 80% | Yes, fail build |
| SSE/Streaming (`/lib/sse/`) | 90% | Yes, fail build |
| Database | 70% | Warning only |
| Components | 60% | Warning only |
| **Overall** | **75%** | Yes, fail build |

## CI/CD Integration

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    - Lint + Type check
    - Unit tests with coverage
    - Upload coverage to Codecov

  integration-tests:
    - Start local Supabase
    - Run integration tests
    - Test RLS policies

  e2e-tests:
    - Build app
    - Run Playwright
    - Upload artifacts on failure
```

## Anti-Patterns to Avoid

1. **Over-mocking:** Don't mock the code you're testing
2. **Implementation testing:** Test behavior, not internals
3. **Brittle snapshots:** Use structured assertions
4. **Ignoring errors:** Test failure paths
5. **Flaky tests:** Fix or delete, never skip
6. **Slow unit tests:** Keep under 2 minutes total

## Success Criteria

1. 100% coverage on auth, rate limiting, API keys
2. Unit tests run in < 2 minutes
3. < 5 bugs escape to production per month
4. Can deploy multiple times per day with confidence
5. No unexpected OpenAI API bills
6. Zero data leakage incidents

## Phases

| Phase | Focus | Duration |
|-------|-------|----------|
| 1 | Foundation: Config, mocks, security tests | 1 week |
| 2 | AI Core: Extraction, matching, generation | 1 week |
| 3 | API Surface: Routes, SSE, responses | 1 week |
| 4 | Integration: Supabase, RLS, workflows | 1 week |
| 5 | E2E & Components: Playwright, React | 1 week |

See implementation plans:
- `2025-12-20-testing-strategy-phase1.md`
- `2025-12-20-testing-strategy-phase2.md`
- `2025-12-20-testing-strategy-phase3.md`
- `2025-12-20-testing-strategy-phase4.md`
- `2025-12-20-testing-strategy-phase5.md`
