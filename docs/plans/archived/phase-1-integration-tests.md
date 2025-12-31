# Phase 1: Integration Tests with Real Supabase

**Priority**: HIGH
**Effort**: 2-3 days
**Status**: Done

## Progress (Last reviewed: 2025-12-31)

| Step | Status | Notes |
|------|--------|-------|
| Step 1: Directory Structure | ✅ Complete | Integration test directories created |
| Step 2: Vitest Integration Config | ✅ Complete | `vitest.integration.config.ts` added |
| Step 3: Global Setup/Teardown | ✅ Complete | `global-setup.ts` handles Supabase lifecycle |
| Step 4: Test Fixtures SQL | ✅ Complete | Fixtures for test data |
| Step 5: Integration Test Utilities | ✅ Complete | `test-utils.ts` with user/client helpers |
| Step 6: Auth Integration Tests | ✅ Complete | signup, login, token-refresh tests |
| Step 7: RLS Policy Tests | ✅ Complete | `rls-policies.integration.test.ts` |
| Step 8: Profile CRUD Tests | ✅ Complete | `profile-crud.integration.test.ts` |
| Step 9: Document Tests | ✅ Complete | `document-crud.integration.test.ts` |
| Step 10: Opportunity Tests | ✅ Complete | `opportunity-crud.integration.test.ts` |
| Step 11: Package.json Scripts | ✅ Complete | `test:integration` script added (PR #38) |
| Step 12: Update CI Workflow | ✅ Complete | CI runs integration tests (PR #38) |

### Drift Notes
Implementation matches plan. All integration tests are in place and running in CI.

## Overview

Replace mocked Supabase tests with integration tests that run against a real local Supabase instance. This validates RLS policies, triggers, and auth flows actually work.

## Prerequisites

- [ ] Supabase CLI installed locally (`supabase --version`)
- [ ] Local Supabase can start (`supabase start` works in repo root)
- [ ] Existing unit tests passing (`pnpm test:web`)

## Steps

### Step 1: Create Integration Test Directory Structure

**Effort**: 15 min

```bash
mkdir -p apps/web/src/__tests__/integration/setup
mkdir -p apps/web/src/__tests__/integration/auth
mkdir -p apps/web/src/__tests__/integration/profile
mkdir -p apps/web/src/__tests__/integration/documents
mkdir -p apps/web/src/__tests__/integration/opportunities
```

**Done when**: Directories exist

---

### Step 2: Create Vitest Integration Config

**Effort**: 30 min

Create `apps/web/vitest.integration.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    name: 'integration',
    include: ['src/__tests__/integration/**/*.integration.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 60000,
    globalSetup: './src/__tests__/integration/setup/global-setup.ts',
    globalTeardown: './src/__tests__/integration/setup/global-teardown.ts',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
})
```

**Done when**: `pnpm vitest --config vitest.integration.config.ts --run` executes (even if no tests found)

---

### Step 3: Create Global Setup/Teardown

**Effort**: 1 hour

Create `apps/web/src/__tests__/integration/setup/global-setup.ts`:
- Check if Supabase is running, start if not
- Reset database to clean state (`supabase db reset`)
- Apply test fixtures

Create `apps/web/src/__tests__/integration/setup/global-teardown.ts`:
- Clean up any remaining test data
- Optionally stop Supabase

**Done when**:
- Running integration tests starts local Supabase automatically
- Database is reset between test runs

---

### Step 4: Create Test Fixtures SQL

**Effort**: 30 min

Create `apps/web/src/__tests__/integration/setup/test-fixtures.sql`:
- Reference data needed by tests (opportunity sources, etc.)
- DO NOT create test users here (create via auth API in tests)

**Done when**: Fixtures file exists and can be applied without errors

---

### Step 5: Create Integration Test Utilities

**Effort**: 1 hour

Create `apps/web/src/__tests__/integration/setup/test-utils.ts`:
- `createTestUser(email, password)` - creates user via admin API
- `deleteTestUser(userId)` - cleanup helper
- `createAuthenticatedClient(email, password)` - returns Supabase client with session
- `getAdminClient()` - returns service role client

**Done when**: Utility functions work and can create/delete test users

---

### Step 6: Write Auth Integration Tests

**Effort**: 2 hours

Create `apps/web/src/__tests__/integration/auth/`:
- `signup.integration.test.ts` - user creation flow
- `login.integration.test.ts` - authentication flow
- `token-refresh.integration.test.ts` - session refresh

**Done when**:
- All auth tests pass
- Tests create real users and verify authentication works

---

### Step 7: Write RLS Policy Tests

**Effort**: 2 hours

Create `apps/web/src/__tests__/integration/profile/rls-policies.integration.test.ts`:
- User can read own profile
- User cannot read other user's profile
- User can update own profile
- User cannot update other user's profile
- User cannot delete other user's data

**Done when**:
- Tests verify RLS policies work correctly
- Tests fail if RLS policies are removed (validate the tests themselves)

---

### Step 8: Write Profile CRUD Tests

**Effort**: 1.5 hours

Create `apps/web/src/__tests__/integration/profile/`:
- `create-profile.integration.test.ts`
- `update-profile.integration.test.ts`

**Done when**: Profile operations work with real database

---

### Step 9: Write Document Tests

**Effort**: 1.5 hours

Create `apps/web/src/__tests__/integration/documents/`:
- `resume-crud.integration.test.ts` - create, read, update, delete
- `story-crud.integration.test.ts`

Note: AI generation is mocked, but database operations are real

**Done when**: Document CRUD operations verified

---

### Step 10: Write Opportunity Tests

**Effort**: 1.5 hours

Create `apps/web/src/__tests__/integration/opportunities/`:
- `opportunity-sync.integration.test.ts`
- `opportunity-matching.integration.test.ts`

Note: Embeddings can be mocked, but storage is real

**Done when**: Opportunity operations verified

---

### Step 11: Add Package.json Scripts

**Effort**: 15 min

Add to `apps/web/package.json`:

```json
{
  "scripts": {
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:integration:watch": "vitest --config vitest.integration.config.ts"
  }
}
```

**Done when**: `pnpm test:integration` runs all integration tests

---

### Step 12: Update CI Workflow

**Effort**: 1 hour

Update `.github/workflows/test.yml`:
- Add `integration-tests` job
- Configure PostgreSQL service container
- Run `supabase start`
- Run `pnpm test:integration`

**Done when**: Integration tests run in CI on every PR

---

## Acceptance Criteria

- [ ] `pnpm test:integration` runs all integration tests locally
- [ ] Tests use real Supabase (not mocks)
- [ ] RLS policies are validated (tests fail if policies removed)
- [ ] Auth flows work with real JWT tokens
- [ ] CI runs integration tests on every PR
- [ ] Tests clean up after themselves (no orphan data)
- [ ] Total integration test count: 15-25 tests

## Dependencies

- None (this is Phase 1)

## Outputs

- `apps/web/vitest.integration.config.ts`
- `apps/web/src/__tests__/integration/` directory with tests
- Updated `.github/workflows/test.yml`
- Updated `apps/web/package.json` with new scripts
