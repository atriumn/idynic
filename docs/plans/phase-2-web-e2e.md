# Phase 2: Web E2E Tests with Playwright

**Priority**: HIGH
**Effort**: 3-4 days
**Status**: Not Started

## Overview

Add Playwright E2E tests for critical web user journeys. Tests run against Vercel preview deployments using a dedicated Supabase test project. Includes both desktop and mobile web testing.

## Prerequisites

- [ ] Phase 1 complete (integration tests working)
- [ ] Dedicated E2E Supabase project created (`idynic-e2e`)
- [ ] Vercel preview deployments working
- [ ] `E2E_SUPABASE_URL` and `E2E_SUPABASE_SERVICE_KEY` secrets configured

## Steps

### Step 1: Create E2E Supabase Project

**Effort**: 30 min

1. Create new Supabase project named `idynic-e2e`
2. Apply all migrations from main project
3. Note the project URL and service role key
4. Add secrets to GitHub: `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_KEY`
5. Add secrets to Vercel for preview deployments

**Done when**:
- E2E project exists with same schema as production
- Secrets configured in GitHub and Vercel

---

### Step 2: Install Playwright

**Effort**: 15 min

```bash
cd apps/web
pnpm add -D @playwright/test
npx playwright install chromium
```

**Done when**: `npx playwright --version` works

---

### Step 3: Create Playwright Config

**Effort**: 30 min

Create `apps/web/playwright.config.ts`:
- Configure test directory (`./e2e`)
- Set up chromium and mobile projects
- Configure baseURL from environment
- Set retries for CI
- Configure screenshot/video on failure

**Done when**: `npx playwright test --list` works (even with no tests)

---

### Step 4: Create E2E Directory Structure

**Effort**: 15 min

```bash
mkdir -p apps/web/e2e/utils
mkdir -p apps/web/e2e/fixtures
mkdir -p apps/web/e2e/auth
mkdir -p apps/web/e2e/profile
mkdir -p apps/web/e2e/documents
mkdir -p apps/web/e2e/opportunities
mkdir -p apps/web/e2e/mobile
touch apps/web/e2e/.auth/.gitkeep
```

Add to `.gitignore`:
```
apps/web/e2e/.auth/user.json
```

**Done when**: Directory structure exists

---

### Step 5: Create Test Data Seeding Utilities

**Effort**: 1.5 hours

Create `apps/web/e2e/utils/seed.ts`:
- `seedTestData(testRunId)` - creates test user with unique email
- Returns user credentials for tests
- Tags user with `test_run_id` in metadata

Create `apps/web/e2e/utils/cleanup.ts`:
- `cleanupTestData(testRunId)` - deletes all data for test run
- Finds users by `test_run_id` metadata
- Cascades delete via user deletion

**Done when**: Can create and delete test users programmatically

---

### Step 6: Create Global Setup

**Effort**: 1 hour

Create `apps/web/e2e/global.setup.ts`:
- Generate unique test run ID
- Seed test data
- Pre-authenticate and save storage state to `.auth/user.json`
- Export credentials as env vars

Create `apps/web/e2e/global.teardown.ts`:
- Clean up test data by run ID

**Done when**: Setup creates authenticated state, teardown cleans up

---

### Step 7: Create Auth E2E Tests

**Effort**: 1.5 hours

Create `apps/web/e2e/auth/`:
- `login.spec.ts` - login with valid/invalid credentials
- `signup.spec.ts` - new user registration
- `logout.spec.ts` - logout flow

**Done when**: Auth tests pass locally against dev server

---

### Step 8: Create Profile E2E Tests

**Effort**: 1.5 hours

Create `apps/web/e2e/profile/`:
- `view-profile.spec.ts` - profile displays correctly
- `edit-profile.spec.ts` - can update profile fields

Use pre-authenticated state from `.auth/user.json`

**Done when**: Profile tests pass locally

---

### Step 9: Create Document E2E Tests

**Effort**: 2 hours

Create `apps/web/e2e/documents/`:
- `generate-resume.spec.ts` - resume generation flow (mocked AI)
- `download-resume.spec.ts` - PDF download works

Create AI mocking mechanism:
- Environment variable `MOCK_AI_RESPONSES=true`
- Conditional mock in AI client

**Done when**: Document tests pass with mocked AI responses

---

### Step 10: Create Opportunity E2E Tests

**Effort**: 1 hour

Create `apps/web/e2e/opportunities/`:
- `view-matches.spec.ts` - matches list displays

**Done when**: Opportunity tests pass locally

---

### Step 11: Create Mobile Web Tests

**Effort**: 1.5 hours

Create `apps/web/e2e/mobile/`:
- `navigation.spec.ts` - mobile nav/hamburger works
- `responsive.spec.ts` - critical layouts render correctly

Use `test.use({ ...devices['iPhone 14'] })`

**Done when**: Mobile tests pass with iPhone emulation

---

### Step 12: Add Package.json Scripts

**Effort**: 15 min

Add to `apps/web/package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

**Done when**: `pnpm test:e2e` runs all E2E tests

---

### Step 13: Create E2E CI Workflow

**Effort**: 1.5 hours

Create `.github/workflows/e2e.yml`:
- Trigger on `deployment_status` (when Vercel preview ready)
- Install Playwright browsers
- Seed test data
- Run tests against preview URL
- Upload artifacts on failure
- Clean up test data

**Done when**: E2E tests run automatically on PR preview deployments

---

### Step 14: Test Full CI Flow

**Effort**: 1 hour

1. Create test PR
2. Wait for Vercel preview
3. Verify E2E workflow triggers
4. Verify tests run against preview
5. Verify cleanup happens

**Done when**: Full PR → Preview → E2E flow works

---

## Acceptance Criteria

- [ ] `pnpm test:e2e` runs all E2E tests locally
- [ ] Tests run against Vercel preview deployments in CI
- [ ] Desktop and mobile web both tested
- [ ] Test data seeded and cleaned up automatically
- [ ] AI responses mocked for determinism
- [ ] Screenshots/videos captured on failure
- [ ] Total E2E test count: 10-12 tests

## Dependencies

- Phase 1 (integration tests) - validates backend works
- E2E Supabase project created
- Vercel preview deployments configured

## Outputs

- `apps/web/playwright.config.ts`
- `apps/web/e2e/` directory with tests
- `.github/workflows/e2e.yml`
- E2E Supabase project (`idynic-e2e`)
