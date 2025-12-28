# Testing Strategy - Idynic

## Overview

This document outlines a comprehensive testing strategy for the Idynic platform across all surfaces: Web, Mobile, API, MCP Server, and Chrome Extension.

**Current State**: Solid unit test foundation (65 tests) with good mocking infrastructure. Primary gaps are integration tests with real services, E2E tests for critical user journeys, and Chrome extension coverage.

---

## Testing Pyramid Target State

```
                    /\
                   /  \         E2E Tests (5-10 critical journeys)
                  /----\        Run: On deploy to staging, before prod
                 /      \
                /--------\      Integration Tests (50-100 tests)
               /          \     Run: Every PR, against real Supabase
              /------------\
             /              \   Unit Tests (200+ tests)
            /----------------\  Run: Every PR, fast feedback
```

---

## Phase 1: Integration Tests with Real Supabase

**Priority**: HIGH
**Effort**: 2-3 days
**Goal**: Test actual database operations, RLS policies, and Supabase functions

### Current Gap

Your existing API tests mock Supabase:
```typescript
// Current: mocked - doesn't test RLS policies
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createMockSupabaseClient()
}))
```

A user could have broken RLS policies and tests would still pass.

### Implementation

#### 1.1 Directory Structure

```
apps/web/src/__tests__/
├── unit/                    # Rename existing tests here
│   ├── components/
│   ├── lib/
│   └── ...
├── integration/             # NEW: Real Supabase tests
│   ├── setup/
│   │   ├── global-setup.ts  # Start local Supabase
│   │   ├── global-teardown.ts
│   │   └── test-fixtures.sql
│   ├── auth/
│   │   ├── signup.integration.test.ts
│   │   ├── login.integration.test.ts
│   │   └── token-refresh.integration.test.ts
│   ├── profile/
│   │   ├── create-profile.integration.test.ts
│   │   ├── update-profile.integration.test.ts
│   │   └── rls-policies.integration.test.ts
│   ├── documents/
│   │   ├── resume-crud.integration.test.ts
│   │   └── story-crud.integration.test.ts
│   └── opportunities/
│       ├── opportunity-matching.integration.test.ts
│       └── opportunity-sync.integration.test.ts
└── e2e/                     # Phase 2
```

#### 1.2 Vitest Configuration for Integration Tests

```typescript
// apps/web/vitest.integration.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    name: 'integration',
    include: ['src/__tests__/integration/**/*.integration.test.ts'],
    environment: 'node', // Not jsdom - these are server-side tests
    globals: true,
    testTimeout: 30000, // DB operations can be slow
    hookTimeout: 60000,
    globalSetup: './src/__tests__/integration/setup/global-setup.ts',
    globalTeardown: './src/__tests__/integration/setup/global-teardown.ts',
    pool: 'forks', // Isolate tests to prevent connection issues
    poolOptions: {
      forks: {
        singleFork: true // Run sequentially to avoid DB conflicts
      }
    }
  }
})
```

#### 1.3 Global Setup - Local Supabase

```typescript
// apps/web/src/__tests__/integration/setup/global-setup.ts
import { execSync } from 'child_process'

export default async function globalSetup() {
  console.log('Starting local Supabase...')

  // Check if Supabase is already running
  try {
    execSync('supabase status', { stdio: 'pipe' })
    console.log('Supabase already running')
  } catch {
    // Start Supabase if not running
    execSync('supabase start', {
      stdio: 'inherit',
      cwd: process.cwd()
    })
  }

  // Reset database to clean state
  execSync('supabase db reset --no-seed', { stdio: 'inherit' })

  // Apply test fixtures
  execSync('psql "$SUPABASE_DB_URL" -f src/__tests__/integration/setup/test-fixtures.sql', {
    stdio: 'inherit',
    env: {
      ...process.env,
      SUPABASE_DB_URL: 'postgresql://postgres:postgres@localhost:54322/postgres'
    }
  })

  console.log('Supabase ready for integration tests')
}
```

#### 1.4 Test Fixtures SQL

```sql
-- apps/web/src/__tests__/integration/setup/test-fixtures.sql

-- Test users (created via Supabase auth, not direct insert)
-- We'll create these programmatically in tests

-- Reference data that tests depend on
INSERT INTO public.opportunity_sources (id, name, type) VALUES
  ('test-source-1', 'Test LinkedIn', 'linkedin'),
  ('test-source-2', 'Test Indeed', 'indeed');

-- Test organization for multi-tenant tests
INSERT INTO public.organizations (id, name, slug) VALUES
  ('test-org-1', 'Test Organization', 'test-org');
```

#### 1.5 Example Integration Test

```typescript
// apps/web/src/__tests__/integration/profile/rls-policies.integration.test.ts
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const supabaseUrl = 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

describe('Profile RLS Policies', () => {
  let userAId: string
  let userBId: string
  let userAClient: ReturnType<typeof createClient>
  let userBClient: ReturnType<typeof createClient>

  beforeAll(async () => {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Create test users
    const { data: userA } = await adminClient.auth.admin.createUser({
      email: 'user-a@test.local',
      password: 'testpassword123',
      email_confirm: true
    })
    userAId = userA.user!.id

    const { data: userB } = await adminClient.auth.admin.createUser({
      email: 'user-b@test.local',
      password: 'testpassword123',
      email_confirm: true
    })
    userBId = userB.user!.id

    // Create authenticated clients
    userAClient = createClient(supabaseUrl, supabaseAnonKey)
    await userAClient.auth.signInWithPassword({
      email: 'user-a@test.local',
      password: 'testpassword123'
    })

    userBClient = createClient(supabaseUrl, supabaseAnonKey)
    await userBClient.auth.signInWithPassword({
      email: 'user-b@test.local',
      password: 'testpassword123'
    })

    // User A creates a profile
    await userAClient.from('profiles').insert({
      id: userAId,
      full_name: 'User A',
      headline: 'Test User A'
    })
  })

  afterAll(async () => {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    await adminClient.auth.admin.deleteUser(userAId)
    await adminClient.auth.admin.deleteUser(userBId)
  })

  it('user can read their own profile', async () => {
    const { data, error } = await userAClient
      .from('profiles')
      .select('*')
      .eq('id', userAId)
      .single()

    expect(error).toBeNull()
    expect(data?.full_name).toBe('User A')
  })

  it('user cannot read another user profile directly', async () => {
    const { data, error } = await userBClient
      .from('profiles')
      .select('*')
      .eq('id', userAId)
      .single()

    // RLS should prevent this - either error or empty result
    expect(data).toBeNull()
  })

  it('user cannot update another user profile', async () => {
    const { error } = await userBClient
      .from('profiles')
      .update({ full_name: 'Hacked!' })
      .eq('id', userAId)

    // Should fail or affect 0 rows
    expect(error).not.toBeNull()
  })
})
```

#### 1.6 Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:integration:watch": "vitest --config vitest.integration.config.ts",
    "test:all": "pnpm test:unit && pnpm test:integration"
  }
}
```

#### 1.7 CI Workflow Update

```yaml
# .github/workflows/test.yml - update integration job
integration-tests:
  runs-on: ubuntu-latest
  # Run on PRs and main pushes

  services:
    postgres:
      image: supabase/postgres:15.1.0.147
      env:
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: postgres
      ports:
        - 54322:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

  steps:
    - uses: actions/checkout@v4

    - uses: supabase/setup-cli@v1
      with:
        version: latest

    - name: Start Supabase
      run: supabase start

    - name: Run Integration Tests
      run: pnpm test:integration
      env:
        SUPABASE_URL: http://localhost:54321
        SUPABASE_ANON_KEY: ${{ secrets.LOCAL_ANON_KEY }}
        SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.LOCAL_SERVICE_KEY }}
```

### What This Tests

- RLS policies actually work (users can't access other users' data)
- Database constraints and triggers fire correctly
- Supabase functions (edge functions, database functions) work
- Auth flows with real JWT tokens
- Migrations are valid and applied correctly

---

## Phase 2: E2E Tests with Playwright

**Priority**: HIGH
**Effort**: 3-4 days
**Goal**: Test critical user journeys through the actual UI

### 2.1 Environment Architecture (Trunk-Based Development)

For trunk-based development with short-lived branches, we use a **dedicated test project** rather than Supabase branching per PR. This is simpler, faster, and appropriate for the rapid merge cadence of trunk-based workflows.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TRUNK-BASED E2E STRATEGY                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Integration Tests (Phase 1)                                    │ │
│  │  ────────────────────────────────────────────────────────────  │ │
│  │  • Run in CI with local Supabase (supabase start)              │ │
│  │  • Fast, no cloud dependency                                    │ │
│  │  • Tests RLS policies, migrations, auth flows                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  E2E Tests (This Phase)                                         │ │
│  │  ────────────────────────────────────────────────────────────  │ │
│  │                                                                 │ │
│  │  ┌─────────────────┐      ┌─────────────────────────────────┐  │ │
│  │  │ Vercel Preview  │      │ Dedicated Test Project          │  │ │
│  │  │ Deployment      │      │ (idynic-e2e)                    │  │ │
│  │  │                 │      │                                 │  │ │
│  │  │ pr-123.vercel   │─────▶│ • Single Supabase instance     │  │ │
│  │  │ pr-456.vercel   │─────▶│ • All E2E tests share it       │  │ │
│  │  │ pr-789.vercel   │─────▶│ • Unique IDs per test run      │  │ │
│  │  │                 │      │ • Cleanup after each run       │  │ │
│  │  └─────────────────┘      └─────────────────────────────────┘  │ │
│  │                                                                 │ │
│  │  Test Run Flow:                                                 │ │
│  │  1. PR opens → Vercel creates preview deployment               │ │
│  │  2. Deployment ready triggers E2E workflow                     │ │
│  │  3. Seed test data with unique run ID: e2e-{pr}-{timestamp}   │ │
│  │  4. Run Playwright against preview URL                         │ │
│  │  5. Cleanup test data by run ID                                │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Schema Changes (Migrations) - USE SUPABASE BRANCHING          │ │
│  │  ────────────────────────────────────────────────────────────  │ │
│  │  • ONLY for PRs that modify supabase/migrations/**            │ │
│  │  • Creates isolated branch DB to validate migration           │ │
│  │  • Catches "works locally, breaks in prod" issues             │ │
│  │  • Branch auto-deletes when PR closes                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Why Dedicated Test Project (Not Branching Per PR)

| Trunk-Based Dev Reality | Why Branching Per PR Doesn't Fit |
|-------------------------|----------------------------------|
| Branches live hours, maybe 1-2 days | Branch DB spin-up adds latency |
| Small, focused changes | Full DB copy is overkill |
| Most PRs don't touch schema | Schema isolation unnecessary |
| Merge frequently to main | Branches accumulate if not cleaned |

**Our approach:**

| Test Type | Environment | When |
|-----------|-------------|------|
| Integration tests | Local Supabase in CI | Every PR |
| E2E tests | Dedicated `idynic-e2e` project | Every PR (on preview deploy) |
| Migration validation | Supabase branching | Only PRs touching `supabase/migrations/**` |

### 2.3 Dedicated Test Project Setup

Create a separate Supabase project specifically for E2E tests:

1. **Create project**: `idynic-e2e` in Supabase dashboard
2. **Apply migrations**: Keep schema in sync with production
3. **Configure Vercel**: Set `E2E_SUPABASE_URL` and `E2E_SUPABASE_SERVICE_KEY` as secrets
4. **No production data**: Only synthetic test data

```typescript
// e2e/utils/seed-test-data.ts
export async function seedTestData(testRunId: string) {
  const adminClient = createClient(
    process.env.E2E_SUPABASE_URL!,
    process.env.E2E_SUPABASE_SERVICE_KEY!
  )

  // Create test user with unique email per test run
  // This allows concurrent PR runs without conflicts
  const testEmail = `e2e-${testRunId}@test.idynic.com`

  const { data: user } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: 'e2e-test-password-123',
    email_confirm: true,
    user_metadata: {
      full_name: 'E2E Test User',
      test_run_id: testRunId  // Tag for cleanup
    }
  })

  // Create profile with test data
  await adminClient.from('profiles').insert({
    id: user.user!.id,
    full_name: 'E2E Test User',
    headline: 'Senior Software Engineer',
    // ... other fields
  })

  return { userId: user.user!.id, email: testEmail }
}

export async function cleanupTestData(testRunId: string) {
  const adminClient = createClient(
    process.env.E2E_SUPABASE_URL!,
    process.env.E2E_SUPABASE_SERVICE_KEY!
  )

  // Find and delete all data for this test run
  const { data: users } = await adminClient.auth.admin.listUsers()

  for (const user of users.users) {
    if (user.user_metadata?.test_run_id === testRunId) {
      // Cascade delete: profiles, documents, etc. via FK constraints
      await adminClient.auth.admin.deleteUser(user.id)
    }
  }
}
```

### 2.4 Migration Testing with Supabase Branching

Use Supabase branching **only** for PRs that modify migrations:

```yaml
# .github/workflows/test-migration.yml
name: Test Migration

on:
  pull_request:
    paths:
      - 'supabase/migrations/**'

jobs:
  test-migration:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Create Supabase branch
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase branches create pr-${{ github.event.number }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Push migrations to branch
        run: supabase db push --branch pr-${{ github.event.number }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Verify migrations applied
        run: |
          # Run a simple query to verify the migration worked
          supabase db execute --branch pr-${{ github.event.number }} \
            --command "SELECT 1"
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      # Branch auto-deletes when PR closes (configure in Supabase dashboard)
```

**Configure auto-deletion:**
1. Supabase Dashboard → Project Settings → Integrations → GitHub
2. Enable "Delete branch on PR close"

### 2.5 Playwright Setup

```bash
# Install
cd apps/web
pnpm add -D @playwright/test
npx playwright install
```

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run sequentially - shared test DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for database consistency
  reporter: [
    ['html'],
    ['github'], // GitHub Actions annotations
  ],

  use: {
    // Use preview URL in CI, localhost in dev
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Setup project - runs before all tests
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
      dependencies: ['setup'],
    },
    // Teardown project - runs after all tests
    {
      name: 'teardown',
      testMatch: /global\.teardown\.ts/,
    },
  ],

  // Local dev server (not used in CI - uses preview URL)
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### 2.6 E2E Test Structure

```
apps/web/e2e/
├── global.setup.ts          # Seed test data before all tests
├── global.teardown.ts       # Cleanup after all tests
├── fixtures/
│   └── test-data.ts         # Test user credentials, etc.
├── utils/
│   ├── seed.ts              # Database seeding functions
│   ├── auth.ts              # Login/logout helpers
│   └── cleanup.ts           # Test data cleanup
├── auth/
│   ├── signup.spec.ts
│   ├── login.spec.ts
│   └── logout.spec.ts
├── onboarding/
│   └── complete-onboarding.spec.ts
├── profile/
│   ├── edit-profile.spec.ts
│   └── view-profile.spec.ts
├── documents/
│   ├── generate-resume.spec.ts    # Uses mocked AI
│   └── download-resume.spec.ts
└── opportunities/
    └── view-matches.spec.ts
```

### 2.7 Global Setup

```typescript
// apps/web/e2e/global.setup.ts
import { chromium, FullConfig } from '@playwright/test'
import { seedTestData } from './utils/seed'

async function globalSetup(config: FullConfig) {
  // Generate unique test run ID
  const testRunId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  // Store for use in tests and teardown
  process.env.TEST_RUN_ID = testRunId

  console.log(`Setting up E2E tests (run: ${testRunId})`)

  // Seed test data
  const testData = await seedTestData(testRunId)

  // Store credentials for tests
  process.env.TEST_USER_EMAIL = testData.email
  process.env.TEST_USER_PASSWORD = 'e2e-test-password-123'
  process.env.TEST_USER_ID = testData.userId

  // Pre-authenticate and save state (optional - speeds up tests)
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${config.projects[0].use.baseURL}/login`)
  await page.fill('[name="email"]', testData.email)
  await page.fill('[name="password"]', 'e2e-test-password-123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')

  // Save authenticated state
  await page.context().storageState({ path: './e2e/.auth/user.json' })

  await browser.close()

  console.log('E2E setup complete')
}

export default globalSetup
```

### 2.8 Example E2E Tests

```typescript
// apps/web/e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Login', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/)

    // Should show user name
    await expect(page.getByText('E2E Test User')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name="email"]', 'wrong@email.com')
    await page.fill('[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.getByText(/invalid.*credentials/i)).toBeVisible()
  })
})
```

```typescript
// apps/web/e2e/documents/generate-resume.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Resume Generation', () => {
  // Use pre-authenticated state
  test.use({ storageState: './e2e/.auth/user.json' })

  test('user can generate a resume (mocked AI)', async ({ page }) => {
    // NOTE: AI is mocked in E2E environment via MOCK_AI_RESPONSES=true
    // Real AI testing happens in weekly eval runs (see Phase 5)

    await page.goto('/documents/resume')

    // Select template
    await page.click('[data-testid="template-professional"]')

    // Click generate
    await page.click('button:has-text("Generate Resume")')

    // Wait for generation (mocked - should be fast)
    await expect(page.getByTestId('resume-preview')).toBeVisible({ timeout: 10000 })

    // Verify content rendered (mocked response has known content)
    await expect(page.getByText('E2E Test User')).toBeVisible()
    await expect(page.getByText('Senior Software Engineer')).toBeVisible()
  })

  test('user can download generated resume', async ({ page }) => {
    await page.goto('/documents/resume')

    // Assuming resume already generated
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Download PDF")')

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/resume.*\.pdf/i)
  })
})
```

### 2.9 Mocking AI in E2E

For E2E tests, we mock AI responses to keep tests fast and deterministic:

```typescript
// apps/web/src/lib/ai/client.ts
import OpenAI from 'openai'

export function createAIClient() {
  // In E2E environment, use mock responses
  if (process.env.MOCK_AI_RESPONSES === 'true') {
    return createMockAIClient()
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
}

function createMockAIClient() {
  return {
    chat: {
      completions: {
        create: async (params: any) => {
          // Return deterministic mock responses based on the prompt
          const mockResponses: Record<string, string> = {
            'resume': 'Generated professional resume content for E2E Test User...',
            'story': 'Generated career story content...',
            'opportunity': 'This opportunity is a great match because...'
          }

          // Detect which type of generation
          const prompt = params.messages?.[0]?.content || ''
          const type = Object.keys(mockResponses).find(k => prompt.includes(k)) || 'default'

          return {
            choices: [{
              message: {
                content: mockResponses[type] || 'Mock AI response'
              }
            }]
          }
        }
      }
    },
    embeddings: {
      create: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    }
  }
}
```

### 2.10 CI Workflow for E2E

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  deployment_status:

jobs:
  e2e:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: cd apps/web && npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: cd apps/web && pnpm test:e2e
        env:
          PLAYWRIGHT_BASE_URL: ${{ github.event.deployment_status.target_url }}
          E2E_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}
          E2E_SUPABASE_SERVICE_KEY: ${{ secrets.E2E_SUPABASE_SERVICE_KEY }}
          MOCK_AI_RESPONSES: 'true'

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 7
```

### 2.11 Mobile Web E2E Testing

Playwright supports mobile browser emulation. Add mobile-specific tests for responsive layouts and touch interactions.

**Already configured** in `playwright.config.ts`:
```typescript
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'mobile',
    use: { ...devices['iPhone 14'] },  // Mobile Safari emulation
  },
]
```

**Mobile Web Test Structure:**

```
apps/web/e2e/
├── auth/
│   ├── login.spec.ts           # Runs on both desktop AND mobile
│   └── login.mobile.spec.ts    # Mobile-only tests (if needed)
├── mobile/                      # Mobile-specific flows
│   ├── navigation.spec.ts       # Mobile nav menu, hamburger
│   ├── touch-gestures.spec.ts   # Swipe, pull-to-refresh
│   └── responsive.spec.ts       # Layout breakpoints
```

**Mobile-Specific Test Example:**

```typescript
// apps/web/e2e/mobile/navigation.spec.ts
import { test, expect, devices } from '@playwright/test'

test.use({ ...devices['iPhone 14'] })

test.describe('Mobile Navigation', () => {
  test('hamburger menu opens and closes', async ({ page }) => {
    await page.goto('/dashboard')

    // Desktop nav should be hidden
    await expect(page.getByTestId('desktop-nav')).not.toBeVisible()

    // Mobile hamburger should be visible
    const hamburger = page.getByTestId('mobile-menu-button')
    await expect(hamburger).toBeVisible()

    // Open menu
    await hamburger.tap()
    await expect(page.getByTestId('mobile-nav')).toBeVisible()

    // Navigate
    await page.getByRole('link', { name: 'Profile' }).tap()
    await expect(page).toHaveURL(/\/profile/)
  })

  test('bottom tab bar navigation works', async ({ page }) => {
    await page.goto('/dashboard')

    // Tap bottom nav items
    await page.getByTestId('tab-opportunities').tap()
    await expect(page).toHaveURL(/\/opportunities/)

    await page.getByTestId('tab-documents').tap()
    await expect(page).toHaveURL(/\/documents/)
  })
})
```

**Key Mobile Web Flows to Test:**

| Flow | Why |
|------|-----|
| Mobile navigation (hamburger/tabs) | Different UI than desktop |
| Touch gestures (swipe to dismiss) | Mobile-specific interactions |
| Viewport-specific layouts | Responsive breakpoints |
| Mobile keyboard handling | Form input behavior |
| PWA install prompt | If applicable |

### 2.12 Critical E2E Test List (Keep Minimal)

Only test flows that would be catastrophic if broken:

**Desktop Web:**

| Test | What it validates |
|------|-------------------|
| `signup.spec.ts` | New users can create accounts |
| `login.spec.ts` | Existing users can authenticate |
| `complete-onboarding.spec.ts` | New users can finish setup |
| `edit-profile.spec.ts` | Users can update their information |
| `generate-resume.spec.ts` | Core feature works (mocked AI) |
| `view-matches.spec.ts` | Opportunity matching displays |

**Mobile Web (runs same tests + mobile-specific):**

| Test | What it validates |
|------|-------------------|
| All desktop tests | Run with iPhone 14 device emulation |
| `mobile/navigation.spec.ts` | Mobile nav works correctly |
| `mobile/responsive.spec.ts` | Critical layouts render properly |

**Cross-Platform (Chrome Extension ↔ Web):**

| Test | What it validates |
|------|-------------------|
| `chrome-extension-capture.spec.ts` | Extension can send jobs to app |

**Total: 10-12 tests across web platforms. No more.**

---

## Phase 3: Chrome Extension Tests

**Priority**: HIGH (currently 0 coverage)
**Effort**: 1-2 days
**Goal**: Test content scripts, background service worker, and API communication

### 3.1 Test Setup

```bash
cd chrome-extension
pnpm add -D jest jest-environment-jsdom @types/jest ts-jest @testing-library/dom
```

```javascript
// chrome-extension/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
}
```

```javascript
// chrome-extension/jest.setup.js

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`)
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
}
```

### 3.2 Test Structure

```
chrome-extension/
├── src/
│   ├── __tests__/
│   │   ├── content-script/
│   │   │   ├── job-parser.test.ts
│   │   │   ├── page-detection.test.ts
│   │   │   └── dom-extraction.test.ts
│   │   ├── background/
│   │   │   ├── message-handler.test.ts
│   │   │   └── api-client.test.ts
│   │   └── utils/
│   │       └── storage.test.ts
│   ├── content-script/
│   ├── background/
│   └── popup/
```

### 3.3 Example Tests

```typescript
// chrome-extension/src/__tests__/content-script/job-parser.test.ts
import { parseLinkedInJob, parseIndeedJob } from '../../content-script/job-parser'

describe('Job Parser', () => {
  describe('LinkedIn', () => {
    it('extracts job title from LinkedIn job page', () => {
      document.body.innerHTML = `
        <div class="job-details-jobs-unified-top-card__job-title">
          Senior Software Engineer
        </div>
        <div class="job-details-jobs-unified-top-card__company-name">
          Acme Corp
        </div>
      `

      const result = parseLinkedInJob(document)

      expect(result.title).toBe('Senior Software Engineer')
      expect(result.company).toBe('Acme Corp')
    })

    it('returns null for non-job pages', () => {
      document.body.innerHTML = `<div>Not a job page</div>`

      const result = parseLinkedInJob(document)

      expect(result).toBeNull()
    })
  })
})
```

```typescript
// chrome-extension/src/__tests__/background/api-client.test.ts
import { sendJobToIdynic } from '../../background/api-client'

describe('API Client', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('sends job data to Idynic API', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'job-123' })
    })

    const job = {
      title: 'Software Engineer',
      company: 'Test Co',
      url: 'https://linkedin.com/jobs/123'
    }

    const result = await sendJobToIdynic(job, 'test-api-key')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/opportunities'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key'
        })
      })
    )
    expect(result.id).toBe('job-123')
  })
})
```

---

## Phase 4: Mobile App E2E Testing (React Native/Expo)

**Priority**: HIGH
**Effort**: 3-4 days
**Goal**: Test native mobile app user journeys on iOS and Android

### 4.1 Tool Selection

| Tool | Pros | Cons | Recommendation |
|------|------|------|----------------|
| **Maestro** | Simple YAML syntax, fast, good DX | Newer, less mature | **Recommended for starting** |
| **Detox** | Mature, Gray-box testing, Jest integration | Complex setup, flaky on CI | Good for complex apps |
| **Appium** | Cross-platform, industry standard | Slow, complex, high maintenance | Enterprise/legacy only |

**Recommendation**: Start with **Maestro** for simplicity, migrate to Detox if you need gray-box testing.

### 4.2 Maestro Setup

```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verify installation
maestro --version
```

**Project structure:**

```
apps/mobile/
├── e2e/
│   ├── flows/
│   │   ├── auth/
│   │   │   ├── login.yaml
│   │   │   ├── signup.yaml
│   │   │   └── logout.yaml
│   │   ├── profile/
│   │   │   ├── view-profile.yaml
│   │   │   └── edit-profile.yaml
│   │   ├── opportunities/
│   │   │   ├── view-matches.yaml
│   │   │   └── opportunity-details.yaml
│   │   └── documents/
│   │       └── view-resume.yaml
│   ├── config/
│   │   ├── env.dev.yaml
│   │   └── env.e2e.yaml
│   └── scripts/
│       └── run-e2e.sh
├── src/
└── ...
```

### 4.3 Example Maestro Flows

```yaml
# apps/mobile/e2e/flows/auth/login.yaml
appId: com.idynic.app
---
- launchApp:
    clearState: true

- assertVisible: "Welcome to Idynic"

- tapOn: "Sign In"

- tapOn:
    id: "email-input"
- inputText: ${E2E_TEST_EMAIL}

- tapOn:
    id: "password-input"
- inputText: ${E2E_TEST_PASSWORD}

- tapOn: "Sign In"

- assertVisible: "Dashboard"
- assertVisible: "Good morning"  # or appropriate greeting
```

```yaml
# apps/mobile/e2e/flows/profile/edit-profile.yaml
appId: com.idynic.app
---
- launchApp

# Navigate to profile
- tapOn:
    id: "tab-profile"

- assertVisible: "Your Profile"

# Edit headline
- tapOn:
    id: "edit-profile-button"

- tapOn:
    id: "headline-input"
- clearText
- inputText: "Senior Software Engineer | React Native"

- tapOn: "Save"

- assertVisible: "Profile updated"
- assertVisible: "Senior Software Engineer | React Native"
```

```yaml
# apps/mobile/e2e/flows/opportunities/view-matches.yaml
appId: com.idynic.app
---
- launchApp

# Navigate to opportunities
- tapOn:
    id: "tab-opportunities"

- assertVisible: "Your Matches"

# Verify list loads
- assertVisible:
    id: "opportunity-list"

# Tap first opportunity
- tapOn:
    id: "opportunity-card-0"

# Verify detail view
- assertVisible: "Match Score"
- assertVisible: "Apply"

# Go back
- tapOn:
    id: "back-button"
```

### 4.4 Test Data Strategy for Mobile

Mobile E2E uses the same dedicated `idynic-e2e` Supabase project as web E2E:

```yaml
# apps/mobile/e2e/config/env.e2e.yaml
E2E_SUPABASE_URL: ${E2E_SUPABASE_URL}
E2E_TEST_EMAIL: ${E2E_TEST_EMAIL}
E2E_TEST_PASSWORD: ${E2E_TEST_PASSWORD}
```

```bash
# apps/mobile/e2e/scripts/run-e2e.sh
#!/bin/bash

# Seed test data (reuse web seeding script)
TEST_RUN_ID="mobile-e2e-$(date +%s)"
node ../web/e2e/utils/seed.js --runId=$TEST_RUN_ID

# Export for Maestro
export E2E_TEST_EMAIL="e2e-${TEST_RUN_ID}@test.idynic.com"
export E2E_TEST_PASSWORD="e2e-test-password-123"

# Run Maestro flows
maestro test e2e/flows/

# Cleanup
node ../web/e2e/utils/cleanup.js --runId=$TEST_RUN_ID
```

### 4.5 CI Workflow for Mobile E2E

```yaml
# .github/workflows/mobile-e2e.yml
name: Mobile E2E Tests

on:
  pull_request:
    paths:
      - 'apps/mobile/**'
  push:
    branches: [main]
    paths:
      - 'apps/mobile/**'

jobs:
  e2e-ios:
    runs-on: macos-14  # M1 runner for iOS simulator

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Build iOS app (Debug)
        run: |
          cd apps/mobile
          npx expo prebuild --platform ios
          cd ios && xcodebuild -workspace idynic.xcworkspace \
            -scheme idynic -configuration Debug \
            -destination 'platform=iOS Simulator,name=iPhone 15' \
            -derivedDataPath build

      - name: Boot iOS Simulator
        run: |
          xcrun simctl boot "iPhone 15" || true
          xcrun simctl install booted apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/idynic.app

      - name: Seed test data
        run: cd apps/mobile && ./e2e/scripts/seed-data.sh
        env:
          E2E_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}
          E2E_SUPABASE_SERVICE_KEY: ${{ secrets.E2E_SUPABASE_SERVICE_KEY }}

      - name: Run Maestro E2E tests
        run: |
          cd apps/mobile
          maestro test e2e/flows/ --format junit --output e2e-results.xml
        env:
          E2E_TEST_EMAIL: ${{ env.E2E_TEST_EMAIL }}
          E2E_TEST_PASSWORD: ${{ env.E2E_TEST_PASSWORD }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: mobile-e2e-results-ios
          path: apps/mobile/e2e-results.xml

      - name: Cleanup test data
        if: always()
        run: cd apps/mobile && ./e2e/scripts/cleanup-data.sh

  e2e-android:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Build Android app (Debug)
        run: |
          cd apps/mobile
          npx expo prebuild --platform android
          cd android && ./gradlew assembleDebug

      - name: Start Android Emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 34
          arch: x86_64
          script: |
            cd apps/mobile
            adb install android/app/build/outputs/apk/debug/app-debug.apk
            ./e2e/scripts/seed-data.sh
            maestro test e2e/flows/ --format junit --output e2e-results.xml
            ./e2e/scripts/cleanup-data.sh
        env:
          E2E_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}
          E2E_SUPABASE_SERVICE_KEY: ${{ secrets.E2E_SUPABASE_SERVICE_KEY }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: mobile-e2e-results-android
          path: apps/mobile/e2e-results.xml
```

### 4.6 Critical Mobile E2E Test List

| Flow | iOS | Android | What it validates |
|------|-----|---------|-------------------|
| `auth/login.yaml` | ✓ | ✓ | Users can authenticate |
| `auth/signup.yaml` | ✓ | ✓ | New users can register |
| `profile/view-profile.yaml` | ✓ | ✓ | Profile data displays |
| `profile/edit-profile.yaml` | ✓ | ✓ | Users can update info |
| `opportunities/view-matches.yaml` | ✓ | ✓ | Matches load and display |
| `documents/view-resume.yaml` | ✓ | ✓ | Resume renders correctly |

**Total: 6 flows × 2 platforms = 12 test runs**

### 4.7 Detox Alternative (For Complex Scenarios)

If Maestro doesn't meet your needs, Detox provides gray-box testing with Jest integration:

```bash
# Install Detox
pnpm add -D detox @types/detox jest
detox init
```

```typescript
// apps/mobile/e2e/login.e2e.ts
import { device, element, by, expect } from 'detox'

describe('Login', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true })
  })

  beforeEach(async () => {
    await device.reloadReactNative()
  })

  it('should login with valid credentials', async () => {
    await element(by.id('email-input')).typeText('test@example.com')
    await element(by.id('password-input')).typeText('password123')
    await element(by.text('Sign In')).tap()

    await expect(element(by.text('Dashboard'))).toBeVisible()
  })
})
```

---

## Phase 5: MCP Server Testing

**Priority**: MEDIUM
**Effort**: 1-2 days
**Goal**: Test MCP server tool execution and Claude integration

### 5.1 Current State

The MCP server (`packages/mcp-server`) has minimal unit tests. It needs:
- Tool execution tests (not just tool definitions)
- Integration tests with mock Claude client
- Error handling validation

### 5.2 Test Structure

```
packages/mcp-server/
├── src/
│   ├── __tests__/
│   │   ├── unit/
│   │   │   ├── tools.test.ts           # Existing: tool definitions
│   │   │   └── client.test.ts          # Existing: client setup
│   │   ├── integration/
│   │   │   ├── tool-execution.test.ts  # NEW: actual tool calls
│   │   │   ├── auth-flow.test.ts       # NEW: auth with Supabase
│   │   │   └── error-handling.test.ts  # NEW: error scenarios
│   │   └── e2e/
│   │       └── claude-integration.test.ts  # NEW: mock Claude client
```

### 5.3 Tool Execution Tests

```typescript
// packages/mcp-server/src/__tests__/integration/tool-execution.test.ts
import { createClient } from '@supabase/supabase-js'
import { MCPServer } from '../../server'
import { handleToolCall } from '../../tools'

describe('MCP Tool Execution', () => {
  let server: MCPServer
  let supabase: ReturnType<typeof createClient>

  beforeAll(async () => {
    // Use E2E Supabase project
    supabase = createClient(
      process.env.E2E_SUPABASE_URL!,
      process.env.E2E_SUPABASE_SERVICE_KEY!
    )

    server = new MCPServer({ supabase })
  })

  describe('get_profile tool', () => {
    it('returns profile for authenticated user', async () => {
      const result = await handleToolCall(server, {
        name: 'get_profile',
        arguments: {},
        context: {
          userId: process.env.E2E_TEST_USER_ID
        }
      })

      expect(result.success).toBe(true)
      expect(result.data.fullName).toBeDefined()
      expect(result.data.headline).toBeDefined()
    })

    it('returns error for unauthenticated request', async () => {
      const result = await handleToolCall(server, {
        name: 'get_profile',
        arguments: {},
        context: {} // No userId
      })

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/unauthorized/i)
    })
  })

  describe('search_opportunities tool', () => {
    it('returns matching opportunities', async () => {
      const result = await handleToolCall(server, {
        name: 'search_opportunities',
        arguments: {
          query: 'software engineer',
          limit: 5
        },
        context: {
          userId: process.env.E2E_TEST_USER_ID
        }
      })

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeLessThanOrEqual(5)
    })
  })
})
```

### 5.4 Mock Claude Client Tests

```typescript
// packages/mcp-server/src/__tests__/e2e/claude-integration.test.ts
import { MCPServer } from '../../server'
import { createMockClaudeClient } from '../mocks/claude-client'

describe('MCP + Claude Integration', () => {
  it('handles full conversation flow', async () => {
    const server = new MCPServer({
      supabase: mockSupabase
    })

    const claude = createMockClaudeClient(server)

    // Simulate Claude calling MCP tools
    const response = await claude.chat({
      messages: [
        { role: 'user', content: 'Show me my profile' }
      ]
    })

    // Verify Claude received tool results
    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({
        name: 'get_profile'
      })
    )
    expect(response.content).toContain('profile')
  })

  it('handles tool errors gracefully', async () => {
    const server = new MCPServer({
      supabase: mockSupabase
    })

    // Force an error
    mockSupabase.setError('connection_failed')

    const claude = createMockClaudeClient(server)

    const response = await claude.chat({
      messages: [
        { role: 'user', content: 'Show me my profile' }
      ]
    })

    // Claude should handle the error gracefully
    expect(response.content).toMatch(/unable|error|try again/i)
  })
})
```

### 5.5 MCP CI Workflow Update

```yaml
# Add to .github/workflows/test.yml
mcp-integration:
  runs-on: ubuntu-latest
  needs: [unit-tests]

  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v2
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install

    - name: Seed test data
      run: node scripts/seed-mcp-test-data.js
      env:
        E2E_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}
        E2E_SUPABASE_SERVICE_KEY: ${{ secrets.E2E_SUPABASE_SERVICE_KEY }}

    - name: Run MCP integration tests
      run: pnpm --filter @idynic/mcp-server test:integration
      env:
        E2E_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}
        E2E_SUPABASE_SERVICE_KEY: ${{ secrets.E2E_SUPABASE_SERVICE_KEY }}
        E2E_TEST_USER_ID: ${{ env.E2E_TEST_USER_ID }}

    - name: Cleanup test data
      if: always()
      run: node scripts/cleanup-mcp-test-data.js
```

---

## Phase 6: API Contract Testing

**Priority**: MEDIUM
**Effort**: 1-2 days
**Goal**: Ensure API changes don't break mobile, MCP, or Chrome extension

### 6.1 Approach: Shared Types + OpenAPI

Since you already have `@idynic/shared`, extend it to be the source of truth:

```typescript
// packages/shared/src/api/types.ts
export interface ProfileResponse {
  id: string
  fullName: string
  headline: string | null
  // ... all fields
}

export interface OpportunityResponse {
  id: string
  title: string
  company: string
  matchScore: number
  // ...
}

// API endpoint definitions
export const API_ENDPOINTS = {
  profile: {
    get: '/api/profile',
    update: '/api/profile'
  },
  opportunities: {
    list: '/api/opportunities',
    get: (id: string) => `/api/opportunities/${id}`
  }
} as const
```

### 6.2 Generate OpenAPI Spec (Optional, Future Enhancement)

```typescript
// apps/web/scripts/generate-openapi.ts
// Use next-swagger-doc or similar to generate spec from route handlers
// Then validate clients against the spec
```

### 6.3 Contract Test Example

```typescript
// packages/shared/src/__tests__/api-contracts.test.ts
import { ProfileResponse, OpportunityResponse } from '../api/types'

describe('API Contract Validation', () => {
  it('ProfileResponse matches expected shape', () => {
    const validProfile: ProfileResponse = {
      id: '123',
      fullName: 'Test User',
      headline: 'Engineer'
    }

    // TypeScript compilation is the contract test
    // If API changes shape, this fails at compile time
    expect(validProfile.fullName).toBeDefined()
  })
})
```

---

## Phase 7: AI Quality Evaluation (Weekly Runs)

**Priority**: MEDIUM-HIGH
**Effort**: 2-3 days initial, ongoing maintenance
**Goal**: Validate AI-generated content quality without blocking CI

### 7.1 Why Weekly Runs?

- E2E tests mock AI responses for speed and determinism
- But resume generation, story synthesis, and opportunity matching ARE core features
- Need to catch AI quality regressions (model changes, prompt drift, etc.)
- Weekly cadence balances coverage with cost

### 7.2 Evaluation Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WEEKLY AI EVAL PIPELINE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. SCHEDULED TRIGGER (GitHub Actions cron)                   │  │
│  │     Every Sunday 2am UTC                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  2. LOAD GOLDEN TEST CASES                                    │  │
│  │                                                               │  │
│  │  test-cases/                                                  │  │
│  │  ├── resume/                                                  │  │
│  │  │   ├── senior-engineer.json    # Input profile             │  │
│  │  │   ├── career-changer.json     # Different persona         │  │
│  │  │   └── new-grad.json                                       │  │
│  │  ├── story/                                                   │  │
│  │  │   └── ...                                                  │  │
│  │  └── opportunity-matching/                                    │  │
│  │      └── ...                                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  3. CALL REAL AI PROVIDERS                                    │  │
│  │                                                               │  │
│  │  For each test case:                                          │  │
│  │  - Call OpenAI/Anthropic with production prompts              │  │
│  │  - Generate actual resume/story/match explanations            │  │
│  │  - Record latency and token usage                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  4. EVALUATE OUTPUTS                                          │  │
│  │                                                               │  │
│  │  Option A: LLM-as-Judge                                       │  │
│  │  - Send output to GPT-4 with evaluation rubric                │  │
│  │  - Score on: relevance, accuracy, tone, completeness          │  │
│  │  - Compare to baseline scores                                 │  │
│  │                                                               │  │
│  │  Option B: Deterministic Checks                               │  │
│  │  - Contains required sections?                                │  │
│  │  - Word count within range?                                   │  │
│  │  - No hallucinated companies/dates?                           │  │
│  │  - Proper formatting?                                         │  │
│  │                                                               │  │
│  │  Option C: Human Review (Slack notification)                  │  │
│  │  - Send samples to #ai-review channel                         │  │
│  │  - Team members provide feedback                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  5. REPORT & ALERT                                            │  │
│  │                                                               │  │
│  │  - Store results in eval-results/ (versioned)                 │  │
│  │  - Compare to previous week's scores                          │  │
│  │  - If quality drops > 10%: Create GitHub issue                │  │
│  │  - If quality drops > 20%: Page on-call                       │  │
│  │  - Weekly summary in Slack                                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Test Case Format

```json
// apps/web/ai-evals/test-cases/resume/senior-engineer.json
{
  "id": "resume-senior-engineer-001",
  "description": "Senior engineer with 8 years experience, multiple companies",
  "input": {
    "profile": {
      "fullName": "Alex Chen",
      "headline": "Senior Software Engineer",
      "yearsExperience": 8,
      "skills": ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS"],
      "experiences": [
        {
          "company": "TechCorp",
          "title": "Senior Software Engineer",
          "startDate": "2021-01",
          "endDate": null,
          "highlights": ["Led team of 5", "Reduced latency by 40%"]
        }
      ]
    },
    "targetRole": "Staff Engineer",
    "template": "professional"
  },
  "expectations": {
    "mustContain": ["Alex Chen", "TechCorp", "Staff Engineer"],
    "mustNotContain": ["[placeholder]", "lorem ipsum"],
    "sections": ["Summary", "Experience", "Skills", "Education"],
    "wordCountRange": [400, 800],
    "toneKeywords": ["professional", "achievement-focused"]
  },
  "baselineScores": {
    "relevance": 8.5,
    "completeness": 9.0,
    "tone": 8.0,
    "overall": 8.5
  }
}
```

### 7.4 Evaluation Script

```typescript
// apps/web/ai-evals/run-eval.ts
import { readdir, readFile, writeFile } from 'fs/promises'
import { createAIClient } from '../src/lib/ai/client'
import { generateResume } from '../src/lib/ai/resume'

interface EvalResult {
  testCaseId: string
  timestamp: string
  output: string
  latencyMs: number
  tokenUsage: { prompt: number, completion: number }
  scores: {
    relevance: number
    completeness: number
    tone: number
    overall: number
  }
  passed: boolean
  notes: string[]
}

async function runEvaluations() {
  const client = createAIClient() // Real client, not mocked
  const results: EvalResult[] = []

  // Load test cases
  const testCases = await loadTestCases('resume')

  for (const testCase of testCases) {
    console.log(`Evaluating: ${testCase.id}`)

    const start = Date.now()

    // Generate with real AI
    const output = await generateResume(client, testCase.input)

    const latencyMs = Date.now() - start

    // Evaluate output
    const scores = await evaluateOutput(client, output, testCase)

    // Check deterministic criteria
    const deterministicChecks = checkDeterministicCriteria(output, testCase.expectations)

    // Compare to baseline
    const passed = scores.overall >= testCase.baselineScores.overall * 0.9 // 10% tolerance

    results.push({
      testCaseId: testCase.id,
      timestamp: new Date().toISOString(),
      output,
      latencyMs,
      tokenUsage: { prompt: 0, completion: 0 }, // Would get from API response
      scores,
      passed,
      notes: deterministicChecks.failures
    })
  }

  // Save results
  await saveResults(results)

  // Generate report
  await generateReport(results)

  // Alert if needed
  await checkAndAlert(results)
}

async function evaluateOutput(client: any, output: string, testCase: any) {
  // LLM-as-Judge evaluation
  const evaluationPrompt = `
    You are evaluating a generated resume. Score each dimension from 1-10.

    TEST CASE: ${testCase.description}

    EXPECTED CRITERIA:
    - Must contain: ${testCase.expectations.mustContain.join(', ')}
    - Required sections: ${testCase.expectations.sections.join(', ')}
    - Tone: ${testCase.expectations.toneKeywords.join(', ')}

    GENERATED OUTPUT:
    ${output}

    Respond in JSON format:
    {
      "relevance": <score>,
      "completeness": <score>,
      "tone": <score>,
      "overall": <score>,
      "reasoning": "<brief explanation>"
    }
  `

  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: evaluationPrompt }],
    response_format: { type: 'json_object' }
  })

  return JSON.parse(response.choices[0].message.content)
}
```

### 7.5 GitHub Actions Workflow

```yaml
# .github/workflows/ai-eval.yml
name: AI Quality Evaluation

on:
  schedule:
    - cron: '0 2 * * 0'  # Every Sunday at 2am UTC
  workflow_dispatch:  # Manual trigger

jobs:
  evaluate:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run AI Evaluations
        run: cd apps/web && pnpm eval:ai
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: ai-eval-results
          path: apps/web/ai-evals/results/

      - name: Check for regressions
        id: check
        run: |
          cd apps/web
          FAILURES=$(cat ai-evals/results/latest.json | jq '.[] | select(.passed == false) | .testCaseId')
          if [ -n "$FAILURES" ]; then
            echo "failures=true" >> $GITHUB_OUTPUT
            echo "failed_tests=$FAILURES" >> $GITHUB_OUTPUT
          fi

      - name: Create issue on failure
        if: steps.check.outputs.failures == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 AI Quality Regression Detected',
              body: `Weekly AI evaluation detected quality regressions.\n\nFailed tests: ${process.env.FAILED_TESTS}\n\nSee workflow run for details.`,
              labels: ['ai-quality', 'automated']
            })
        env:
          FAILED_TESTS: ${{ steps.check.outputs.failed_tests }}

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Weekly AI Eval Complete",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "📊 *Weekly AI Quality Report*\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Results>"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Phase 8: Visual Regression Testing (DEFERRED)

**Priority**: LOW
**Status**: DEFERRED until UI stabilizes
**Effort estimate**: 2-3 days when ready

### Why Defer?

- UI is likely still changing frequently
- Visual regression tests require stable designs
- High maintenance cost for early-stage product
- Existing component tests catch most issues

### When to Implement

- After design system is finalized
- When you have dedicated QA resources
- Before major rebrand or theme overhaul

### Recommended Approach (When Ready)

**Tools:**
- **Chromatic** (Storybook-based) - Best for component libraries
- **Percy** (Percy.io) - Best for full-page screenshots
- **Playwright** built-in screenshots - Free, good enough for basic needs

**Implementation outline:**

```typescript
// apps/web/e2e/visual/homepage.visual.spec.ts
import { test, expect } from '@playwright/test'

test('homepage visual regression', async ({ page }) => {
  await page.goto('/')

  // Wait for content to stabilize
  await page.waitForLoadState('networkidle')

  // Take screenshot and compare to baseline
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,
    threshold: 0.2
  })
})

test('dashboard visual regression - light mode', async ({ page }) => {
  await page.goto('/dashboard')
  await page.emulateMedia({ colorScheme: 'light' })

  await expect(page).toHaveScreenshot('dashboard-light.png')
})

test('dashboard visual regression - dark mode', async ({ page }) => {
  await page.goto('/dashboard')
  await page.emulateMedia({ colorScheme: 'dark' })

  await expect(page).toHaveScreenshot('dashboard-dark.png')
})
```

---

## Phase 9: Performance Testing (DEFERRED)

**Priority**: LOW
**Status**: DEFERRED until production traffic patterns emerge
**Effort estimate**: 3-5 days when ready

### Why Defer?

- Need production traffic patterns to set realistic baselines
- Premature optimization is counterproductive
- Current scale doesn't justify investment

### When to Implement

- When you hit 1000+ DAU
- Before major infrastructure changes
- When users report slowness

### Recommended Approach (When Ready)

**Tools:**
- **k6** - Load testing (Grafana ecosystem)
- **Artillery** - Load testing (Node.js native)
- **Lighthouse CI** - Web performance metrics
- **Playwright** - Client-side performance traces

**Key metrics to track:**

| Metric | Target | Tool |
|--------|--------|------|
| Time to First Byte | < 200ms | k6, Artillery |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| API P95 latency | < 500ms | k6 |
| Concurrent users | 100+ | k6 |
| Resume generation time | < 10s | Custom |

**Implementation outline:**

```javascript
// perf-tests/api-load.k6.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up
    { duration: '1m', target: 20 },   // Sustain
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    http_req_failed: ['rate<0.01'],    // <1% errors
  },
}

export default function () {
  const res = http.get('https://staging.idynic.com/api/profile', {
    headers: {
      'Authorization': `Bearer ${__ENV.TEST_TOKEN}`
    }
  })

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 500,
  })

  sleep(1)
}
```

---

## Phase 10: Pact Contract Testing (DEFERRED)

**Priority**: LOW
**Status**: DEFERRED - shared types sufficient for now
**Effort estimate**: 3-4 days when ready

### Why Defer?

- `@idynic/shared` types already provide compile-time safety
- Pact adds complexity (broker, versioning, CI integration)
- Most valuable when teams work independently on API and clients
- Current team size doesn't justify overhead

### When to Implement

- When mobile and web teams work independently
- When API changes frequently break clients
- When you have a dedicated API team

### Recommended Approach (When Ready)

**Tools:**
- **Pact** (pact.io) - Industry standard for contract testing
- **Pact Broker** - Central contract storage

**How Pact works:**

```
┌─────────────────┐                      ┌─────────────────┐
│  Mobile App     │                      │  Web API        │
│  (Consumer)     │                      │  (Provider)     │
├─────────────────┤                      ├─────────────────┤
│                 │                      │                 │
│  1. Write       │   ┌──────────────┐  │  3. Verify      │
│     consumer    │──▶│ Pact Broker  │◀──│     contracts   │
│     tests       │   │              │   │     against API │
│                 │   │  Stores      │   │                 │
│  2. Generate    │   │  contracts   │   │  4. If fails,   │
│     contracts   │   │              │   │     API change  │
│     (pacts)     │   └──────────────┘   │     breaks      │
│                 │                      │     contract    │
└─────────────────┘                      └─────────────────┘
```

---

## Implementation Priority Summary

| Phase | Platform | Priority | Effort | Status |
|-------|----------|----------|--------|--------|
| 1. Integration tests (real Supabase) | API/Web | HIGH | 2-3 days | **DO FIRST** |
| 2. Web E2E tests (Playwright) | Web + Mobile Web | HIGH | 3-4 days | **DO SECOND** |
| 3. Chrome extension tests | Chrome Extension | HIGH | 1-2 days | **DO THIRD** |
| 4. Mobile App E2E (Maestro) | iOS + Android | HIGH | 3-4 days | **DO FOURTH** |
| 5. MCP Server testing | MCP | MEDIUM | 1-2 days | After Phase 1-4 |
| 6. API contract testing | Cross-platform | MEDIUM | 1-2 days | After Phase 1-4 |
| 7. AI quality evals (weekly) | AI Features | MEDIUM-HIGH | 2-3 days | After Phase 1-4 |
| 8. Visual regression | Web | LOW | 2-3 days | **DEFERRED** |
| 9. Performance testing | All | LOW | 3-5 days | **DEFERRED** |
| 10. Pact contract testing | Cross-platform | LOW | 3-4 days | **DEFERRED** |

### Platform Coverage Summary

| Platform | Unit | Integration | E2E | Status |
|----------|------|-------------|-----|--------|
| **Web (Desktop)** | ✓ Existing | Phase 1 | Phase 2 | Covered |
| **Web (Mobile)** | ✓ Existing | Phase 1 | Phase 2 | Covered |
| **Mobile App (iOS)** | ✓ Existing | — | Phase 4 | Covered |
| **Mobile App (Android)** | ✓ Existing | — | Phase 4 | Covered |
| **Chrome Extension** | Phase 3 | — | Phase 2 (cross-platform) | Covered |
| **MCP Server** | ✓ Existing | Phase 5 | Phase 5 | Covered |
| **API** | ✓ Existing | Phase 1 | Phase 2 (via web) | Covered |

---

## Implementation Plans

Each phase has a detailed, step-by-step implementation plan:

| Phase | Plan File | Status |
|-------|-----------|--------|
| 1. Integration Tests | [phase-1-integration-tests.md](plans/phase-1-integration-tests.md) | Not Started |
| 2. Web E2E | [phase-2-web-e2e.md](plans/phase-2-web-e2e.md) | Not Started |
| 3. Chrome Extension | [phase-3-chrome-extension.md](plans/phase-3-chrome-extension.md) | Not Started |
| 4. Mobile App E2E | [phase-4-mobile-e2e.md](plans/phase-4-mobile-e2e.md) | Not Started |
| 5. MCP Server | [phase-5-mcp-server.md](plans/phase-5-mcp-server.md) | Not Started |
| 6. API Contracts | [phase-6-api-contracts.md](plans/phase-6-api-contracts.md) | Not Started |
| 7. AI Evals | [phase-7-ai-evals.md](plans/phase-7-ai-evals.md) | Not Started |
| 8. Visual Regression | [phase-8-visual-regression.md](plans/phase-8-visual-regression.md) | DEFERRED |
| 9. Performance | [phase-9-performance.md](plans/phase-9-performance.md) | DEFERRED |
| 10. Pact Contracts | [phase-10-pact-contracts.md](plans/phase-10-pact-contracts.md) | DEFERRED |

## Next Steps

1. Review and approve this strategy
2. Create dedicated E2E Supabase project (`idynic-e2e`)
3. Execute Phase 1 plan: [phase-1-integration-tests.md](plans/phase-1-integration-tests.md)
