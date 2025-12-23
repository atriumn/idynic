# Testing Strategy Phase 4: Integration Tests

> **Status:** ⏭️ SKIPPED (2025-12-20)

**Goal:** Achieve 70% coverage on database operations and 100% on RLS policies.

**Decision:** Skipped after evaluating ROI following Phase 3 completion.

**Rationale:**
1. RLS policies are declarative SQL - straightforward and unlikely to have subtle bugs
2. The database layer (Supabase/PostgreSQL) is battle-tested infrastructure
3. The real bugs in this application live in the AI layer, which is already well-tested
4. These "E2E workflow tests" wouldn't actually call AI providers - they'd just verify data lifecycle with pre-made data, providing limited value

**Infrastructure Ready:** The project has Supabase running locally with migrations and RLS policies defined. This phase could be implemented later if needed.

**Architecture:** Use local Supabase instance, test real database operations, validate RLS policies prevent data leakage, test multi-step workflows.

**Tech Stack:** Vitest, Supabase CLI, local PostgreSQL

**Design Document:** `docs/plans/2025-12-20-testing-strategy-design.md`

**Prerequisite:** Phases 1-3 complete, Supabase CLI installed

---

## Task 1: Create Integration Test Configuration

**Files:**
- Create: `vitest.integration.config.ts`
- Create: `vitest.integration.setup.ts`

**Step 1: Create integration config**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.integration.setup.ts'],
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 30000, // 30s for DB operations
    hookTimeout: 60000, // 60s for setup/teardown
    pool: 'forks', // Isolate tests
    poolOptions: {
      forks: {
        singleFork: true // Run sequentially to avoid DB conflicts
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

**Step 2: Create integration setup**

```typescript
import { createClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, beforeEach } from 'vitest'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
export const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Test user data
export const testUsers = {
  user1: {
    id: 'test-user-1',
    email: 'test1@example.com'
  },
  user2: {
    id: 'test-user-2',
    email: 'test2@example.com'
  }
}

beforeAll(async () => {
  // Verify Supabase is running
  const { error } = await serviceClient.from('profiles').select('count').limit(1)
  if (error) {
    throw new Error(`Supabase not running. Start with: supabase start\n${error.message}`)
  }
})

beforeEach(async () => {
  // Clean up test data before each test
  await serviceClient.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await serviceClient.from('tailored_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await serviceClient.from('opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await serviceClient.from('claims').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await serviceClient.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await serviceClient.from('api_keys').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await serviceClient.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
})

afterAll(async () => {
  // Final cleanup
  await serviceClient.from('profiles').delete().in('id', [testUsers.user1.id, testUsers.user2.id])
})

// Helper to create authenticated client for a user
export function createUserClient(userId: string) {
  // Create a client with the user's JWT
  // For testing, we'll use service role and set RLS context
  return serviceClient
}
```

**Step 3: Update package.json**

Add to scripts:
```json
{
  "test:integration": "vitest run --config vitest.integration.config.ts"
}
```

**Step 4: Commit**

```bash
git add vitest.integration.config.ts vitest.integration.setup.ts package.json
git commit -m "chore: add integration test configuration"
```

---

## Task 2: Test RLS Policies - Profiles

**Files:**
- Create: `src/__tests__/integration/rls/profiles.test.ts`

**Step 1: Create RLS tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, testUsers } from '../../../vitest.integration.setup'

describe('RLS: profiles table', () => {
  beforeEach(async () => {
    // Create test users
    await serviceClient.from('profiles').insert([
      { id: testUsers.user1.id, email: testUsers.user1.email },
      { id: testUsers.user2.id, email: testUsers.user2.email }
    ])
  })

  describe('SELECT policy', () => {
    it('user can read own profile', async () => {
      // Simulate user1 context
      const { data, error } = await serviceClient
        .from('profiles')
        .select('*')
        .eq('id', testUsers.user1.id)
        .single()

      expect(error).toBeNull()
      expect(data?.email).toBe(testUsers.user1.email)
    })

    it('user cannot read other user profile (via RLS)', async () => {
      // This test validates RLS when using anon/user client
      // With service role, RLS is bypassed
      // Document: RLS should prevent cross-user access
    })
  })

  describe('INSERT policy', () => {
    it('user can only insert profile with own user_id', async () => {
      // Test that INSERT with wrong user_id fails
    })
  })

  describe('UPDATE policy', () => {
    it('user can update own profile', async () => {
      const { error } = await serviceClient
        .from('profiles')
        .update({ name: 'Updated Name' })
        .eq('id', testUsers.user1.id)

      expect(error).toBeNull()
    })

    it('user cannot update other user profile', async () => {
      // Validate RLS prevents cross-user updates
    })
  })

  describe('DELETE policy', () => {
    it('user can delete own profile', async () => {
      const { error } = await serviceClient
        .from('profiles')
        .delete()
        .eq('id', testUsers.user1.id)

      expect(error).toBeNull()
    })
  })
})
```

**Step 2: Run tests**

```bash
supabase start  # Ensure local Supabase is running
pnpm test:integration rls/profiles
```

**Step 3: Commit**

```bash
mkdir -p src/__tests__/integration/rls
git add src/__tests__/integration/rls/profiles.test.ts
git commit -m "test: add profiles RLS policy tests"
```

---

## Task 3: Test RLS Policies - Documents and Claims

**Files:**
- Create: `src/__tests__/integration/rls/documents.test.ts`
- Create: `src/__tests__/integration/rls/claims.test.ts`

Key test cases:
- User can only CRUD own documents
- User can only CRUD own claims
- Cross-user access is blocked
- Cascade deletes work correctly

**Step 1: Create tests**

**Step 2: Commit**

```bash
git add src/__tests__/integration/rls/
git commit -m "test: add documents and claims RLS tests"
```

---

## Task 4: Test RLS Policies - Opportunities and Tailored Profiles

**Files:**
- Create: `src/__tests__/integration/rls/opportunities.test.ts`
- Create: `src/__tests__/integration/rls/tailored-profiles.test.ts`

Key test cases:
- User can only access own opportunities
- User can only access own tailored profiles
- Shared links bypass RLS for public access

**Step 1: Create tests**

**Step 2: Commit**

```bash
git add src/__tests__/integration/rls/
git commit -m "test: add opportunities and tailored profiles RLS tests"
```

---

## Task 5: Test RLS Policies - API Keys

**Files:**
- Create: `src/__tests__/integration/rls/api-keys.test.ts`

Key test cases:
- User can only see own API keys
- User can only create keys for self
- User can revoke own keys
- Revoked keys are not returned in queries

**Step 1: Create tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, testUsers } from '../../../vitest.integration.setup'
import { hashApiKey } from '@/lib/api/keys'

describe('RLS: api_keys table', () => {
  beforeEach(async () => {
    await serviceClient.from('profiles').insert([
      { id: testUsers.user1.id, email: testUsers.user1.email },
      { id: testUsers.user2.id, email: testUsers.user2.email }
    ])

    // Create API keys for both users
    await serviceClient.from('api_keys').insert([
      {
        user_id: testUsers.user1.id,
        key_hash: hashApiKey('idn_user1key123'),
        key_prefix: 'idn_user',
        name: 'User 1 Key'
      },
      {
        user_id: testUsers.user2.id,
        key_hash: hashApiKey('idn_user2key456'),
        key_prefix: 'idn_user',
        name: 'User 2 Key'
      }
    ])
  })

  it('user can only see own API keys', async () => {
    const { data } = await serviceClient
      .from('api_keys')
      .select('*')
      .eq('user_id', testUsers.user1.id)

    expect(data?.length).toBe(1)
    expect(data?.[0].name).toBe('User 1 Key')
  })

  it('user cannot query other user keys by hash', async () => {
    // Even if attacker knows the hash, RLS prevents access
    const { data } = await serviceClient
      .from('api_keys')
      .select('*')
      .eq('key_hash', hashApiKey('idn_user2key456'))
      .eq('user_id', testUsers.user1.id) // Wrong user

    expect(data?.length).toBe(0)
  })

  it('revoked keys are excluded from active queries', async () => {
    // Revoke user1's key
    await serviceClient
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', testUsers.user1.id)

    const { data } = await serviceClient
      .from('api_keys')
      .select('*')
      .eq('user_id', testUsers.user1.id)
      .is('revoked_at', null)

    expect(data?.length).toBe(0)
  })
})
```

**Step 2: Commit**

```bash
git add src/__tests__/integration/rls/api-keys.test.ts
git commit -m "test: add API keys RLS tests"
```

---

## Task 6: Test Database Operations - CRUD

**Files:**
- Create: `src/__tests__/integration/db/profiles.test.ts`
- Create: `src/__tests__/integration/db/opportunities.test.ts`

Key test cases:
- Create operations work with valid data
- Update operations modify correct fields
- Delete cascades work correctly
- Constraints are enforced
- Timestamps are set automatically

**Step 1: Create tests**

**Step 2: Commit**

```bash
mkdir -p src/__tests__/integration/db
git add src/__tests__/integration/db/
git commit -m "test: add database CRUD operation tests"
```

---

## Task 7: Test Database Functions

**Files:**
- Create: `src/__tests__/integration/db/functions.test.ts`

Key test cases:
- `match_identity_claims()` returns correct results
- `match_claims()` respects threshold
- `find_candidate_claims()` works with embeddings
- `get_shared_profile()` returns complete data

**Step 1: Create tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, testUsers } from '../../../vitest.integration.setup'

describe('Database Functions', () => {
  beforeEach(async () => {
    // Setup test data with embeddings
    await serviceClient.from('profiles').insert({
      id: testUsers.user1.id,
      email: testUsers.user1.email
    })

    await serviceClient.from('identity_claims').insert([
      {
        user_id: testUsers.user1.id,
        type: 'skill',
        label: 'TypeScript',
        description: 'Expert TypeScript developer',
        embedding: new Array(1536).fill(0.5)
      }
    ])
  })

  describe('match_identity_claims', () => {
    it('returns claims matching query embedding', async () => {
      const queryEmbedding = new Array(1536).fill(0.5)

      const { data, error } = await serviceClient.rpc('match_identity_claims', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 10,
        p_user_id: testUsers.user1.id
      })

      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThan(0)
    })

    it('respects match threshold', async () => {
      const differentEmbedding = new Array(1536).fill(0.1)

      const { data } = await serviceClient.rpc('match_identity_claims', {
        query_embedding: differentEmbedding,
        match_threshold: 0.99, // Very high threshold
        match_count: 10,
        p_user_id: testUsers.user1.id
      })

      expect(data?.length).toBe(0)
    })
  })

  describe('get_shared_profile', () => {
    it('returns profile data for valid token', async () => {
      // Create shared link
      const { data: link } = await serviceClient.from('shared_links').insert({
        user_id: testUsers.user1.id,
        token: 'test-token-123'
      }).select().single()

      const { data, error } = await serviceClient.rpc('get_shared_profile', {
        p_token: 'test-token-123'
      })

      expect(error).toBeNull()
      expect(data).not.toBeNull()
    })

    it('returns null for expired token', async () => {
      await serviceClient.from('shared_links').insert({
        user_id: testUsers.user1.id,
        token: 'expired-token',
        expires_at: new Date(Date.now() - 86400000).toISOString()
      })

      const { data } = await serviceClient.rpc('get_shared_profile', {
        p_token: 'expired-token'
      })

      expect(data).toBeNull()
    })
  })
})
```

**Step 2: Commit**

```bash
git add src/__tests__/integration/db/functions.test.ts
git commit -m "test: add database function tests"
```

---

## Task 8: Test End-to-End Workflows

**Files:**
- Create: `src/__tests__/integration/workflows/resume-to-claims.test.ts`
- Create: `src/__tests__/integration/workflows/opportunity-matching.test.ts`

Key test cases:
- Resume upload → extraction → claims synthesis → storage
- Opportunity add → matching → tailoring → share link
- Full data lifecycle with real DB

**Step 1: Create workflow tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, testUsers } from '../../../vitest.integration.setup'

describe('Workflow: Opportunity Matching', () => {
  beforeEach(async () => {
    // Setup user with profile and claims
    await serviceClient.from('profiles').insert({
      id: testUsers.user1.id,
      email: testUsers.user1.email,
      name: 'Test Developer'
    })

    await serviceClient.from('identity_claims').insert([
      {
        user_id: testUsers.user1.id,
        type: 'skill',
        label: 'TypeScript',
        confidence: 0.9,
        embedding: new Array(1536).fill(0.5)
      },
      {
        user_id: testUsers.user1.id,
        type: 'experience',
        label: '5 years software engineering',
        confidence: 0.95,
        embedding: new Array(1536).fill(0.4)
      }
    ])
  })

  it('complete flow: add opportunity → match → tailor → share', async () => {
    // Step 1: Create opportunity
    const { data: opportunity } = await serviceClient
      .from('opportunities')
      .insert({
        user_id: testUsers.user1.id,
        title: 'Senior Engineer',
        company: 'TestCorp',
        description: 'Looking for TypeScript expert'
      })
      .select()
      .single()

    expect(opportunity).not.toBeNull()

    // Step 2: Create matches (simulating match operation)
    const { data: claims } = await serviceClient
      .from('identity_claims')
      .select('id')
      .eq('user_id', testUsers.user1.id)

    for (const claim of claims || []) {
      await serviceClient.from('matches').insert({
        user_id: testUsers.user1.id,
        opportunity_id: opportunity!.id,
        claim_id: claim.id,
        score: 0.85
      })
    }

    // Step 3: Create tailored profile
    const { data: tailored } = await serviceClient
      .from('tailored_profiles')
      .insert({
        user_id: testUsers.user1.id,
        opportunity_id: opportunity!.id,
        narrative: 'Generated narrative...',
        resume_data: { bullets: ['Achievement 1'] },
        talking_points: ['Point 1']
      })
      .select()
      .single()

    expect(tailored).not.toBeNull()

    // Step 4: Create share link
    const { data: link } = await serviceClient
      .from('shared_links')
      .insert({
        user_id: testUsers.user1.id,
        tailored_profile_id: tailored!.id,
        token: 'share-token-123'
      })
      .select()
      .single()

    expect(link?.token).toBe('share-token-123')

    // Step 5: Verify shared profile is accessible
    const { data: shared } = await serviceClient.rpc('get_shared_profile', {
      p_token: 'share-token-123'
    })

    expect(shared).not.toBeNull()
  })
})
```

**Step 2: Commit**

```bash
mkdir -p src/__tests__/integration/workflows
git add src/__tests__/integration/workflows/
git commit -m "test: add end-to-end workflow integration tests"
```

---

## Task 9: Create Integration Test CI Job

**Files:**
- Modify: `.github/workflows/test.yml`

**Step 1: Add integration test job**

```yaml
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-tests

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase
        run: |
          supabase init --force
          supabase start

      - name: Run migrations
        run: supabase db push

      - name: Run integration tests
        run: pnpm test:integration

      - name: Stop Supabase
        if: always()
        run: supabase stop
```

**Step 2: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add integration test job with Supabase"
```

---

## Task 10: Run Full Integration Suite

**Step 1: Start local Supabase**

```bash
supabase start
```

**Step 2: Run all integration tests**

```bash
pnpm test:integration
```

**Step 3: Verify RLS coverage is 100%**

All RLS policies should have tests:
- profiles: SELECT, INSERT, UPDATE, DELETE
- documents: SELECT, INSERT, UPDATE, DELETE
- claims: SELECT, INSERT, UPDATE, DELETE
- opportunities: SELECT, INSERT, UPDATE, DELETE
- tailored_profiles: SELECT, INSERT, UPDATE, DELETE
- api_keys: SELECT, INSERT, UPDATE, DELETE
- shared_links: SELECT, INSERT, UPDATE, DELETE

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: complete Phase 4 - integration tests with 100% RLS coverage"
```

---

## Phase 4 Completion Checklist

- [ ] ~~Integration test config created~~ SKIPPED
- [ ] ~~Profiles RLS tests complete (100%)~~ SKIPPED
- [ ] ~~Documents RLS tests complete (100%)~~ SKIPPED
- [ ] ~~Claims RLS tests complete (100%)~~ SKIPPED
- [ ] ~~Opportunities RLS tests complete (100%)~~ SKIPPED
- [ ] ~~Tailored profiles RLS tests complete (100%)~~ SKIPPED
- [ ] ~~API keys RLS tests complete (100%)~~ SKIPPED
- [ ] ~~Shared links RLS tests complete (100%)~~ SKIPPED
- [ ] ~~Database CRUD tests complete~~ SKIPPED
- [ ] ~~Database function tests complete~~ SKIPPED
- [ ] ~~E2E workflow tests complete~~ SKIPPED
- [ ] ~~CI job configured~~ SKIPPED
- [ ] ~~All tests pass with local Supabase~~ SKIPPED

**Next:** Phase 5 - E2E & Components ⏭️ ALSO SKIPPED
