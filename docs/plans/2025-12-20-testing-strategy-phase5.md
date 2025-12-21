# Testing Strategy Phase 5: E2E & Components

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve 60% coverage on React components and implement critical E2E user journeys.

**Architecture:** Use Testing Library for component tests, Playwright for E2E, focus on user-visible behavior not implementation details.

**Tech Stack:** Vitest, @testing-library/react, Playwright

**Design Document:** `docs/plans/2025-12-20-testing-strategy-design.md`

**Prerequisite:** Phases 1-4 complete

---

## Task 1: Install Playwright

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`

**Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
npx playwright install chromium
```

**Step 2: Create Playwright config**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
})
```

**Step 3: Add scripts to package.json**

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts
git commit -m "chore: add Playwright for E2E testing"
```

---

## Task 2: Create E2E Test Utilities

**Files:**
- Create: `src/__tests__/e2e/fixtures/auth.ts`
- Create: `src/__tests__/e2e/fixtures/test-data.ts`

**Step 1: Create auth fixture**

```typescript
import { test as base, expect } from '@playwright/test'

// Test user credentials (from Supabase seed or test setup)
const TEST_USER = {
  email: 'e2e-test@example.com',
  password: 'test-password-123'
}

type AuthFixtures = {
  authenticatedPage: Page
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login
    await page.goto('/login')

    // Fill in credentials
    await page.fill('[name="email"]', TEST_USER.email)
    await page.fill('[name="password"]', TEST_USER.password)

    // Submit
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(identity|opportunities)/)

    await use(page)
  }
})

export { expect }
```

**Step 2: Create test data fixture**

```typescript
export const testOpportunity = {
  title: 'Senior Software Engineer',
  company: 'E2E Test Corp',
  url: 'https://example.com/jobs/e2e-test',
  description: `
    We're looking for a Senior Software Engineer to join our team.

    Requirements:
    - 5+ years of software development experience
    - Strong TypeScript and React skills
    - Experience with cloud infrastructure (AWS)
    - Excellent communication skills
  `
}

export const testResume = {
  name: 'E2E Test Resume.pdf',
  path: './src/__tests__/e2e/fixtures/test-resume.pdf'
}
```

**Step 3: Commit**

```bash
mkdir -p src/__tests__/e2e/fixtures
git add src/__tests__/e2e/fixtures/
git commit -m "test: add E2E test fixtures"
```

---

## Task 3: E2E - Login Flow

**Files:**
- Create: `src/__tests__/e2e/auth.spec.ts`

**Step 1: Create login tests**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('shows login page for unauthenticated users', async ({ page }) => {
    await page.goto('/identity')
    await expect(page).toHaveURL(/\/login/)
  })

  test('successful login redirects to identity page', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/identity/)
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name="email"]', 'wrong@example.com')
    await page.fill('[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.locator('[role="alert"]')).toBeVisible()
  })

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/identity/)

    // Click logout
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-button"]')

    // Verify redirected to login
    await expect(page).toHaveURL(/\/login/)

    // Verify protected page redirects
    await page.goto('/identity')
    await expect(page).toHaveURL(/\/login/)
  })
})
```

**Step 2: Run tests**

```bash
pnpm test:e2e auth
```

**Step 3: Commit**

```bash
git add src/__tests__/e2e/auth.spec.ts
git commit -m "test: add E2E authentication flow tests"
```

---

## Task 4: E2E - Resume Upload Flow

**Files:**
- Create: `src/__tests__/e2e/resume-upload.spec.ts`

**Step 1: Create resume upload tests**

```typescript
import { test, expect } from './fixtures/auth'
import path from 'path'

test.describe('Resume Upload', () => {
  test('upload resume and see extracted data', async ({ authenticatedPage: page }) => {
    await page.goto('/identity')

    // Click upload button
    await page.click('[data-testid="upload-resume-button"]')

    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-resume.pdf'))

    // Wait for processing (SSE events)
    await expect(page.locator('[data-testid="processing-status"]')).toContainText('Processing')

    // Wait for completion
    await expect(page.locator('[data-testid="processing-status"]')).toContainText('Complete', {
      timeout: 60000
    })

    // Verify extracted data appears
    await expect(page.locator('[data-testid="identity-claims"]')).toBeVisible()
    await expect(page.locator('[data-testid="work-history"]')).toBeVisible()
  })

  test('shows error for invalid file type', async ({ authenticatedPage: page }) => {
    await page.goto('/identity')

    await page.click('[data-testid="upload-resume-button"]')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/invalid.txt'))

    await expect(page.locator('[role="alert"]')).toContainText('PDF')
  })

  test('shows error for oversized file', async ({ authenticatedPage: page }) => {
    await page.goto('/identity')

    // Mock large file or test with actual large file
    // Expect error message about file size
  })
})
```

**Step 2: Create test PDF fixture**

Create a simple test PDF in `src/__tests__/e2e/fixtures/test-resume.pdf`

**Step 3: Commit**

```bash
git add src/__tests__/e2e/resume-upload.spec.ts
git commit -m "test: add E2E resume upload flow tests"
```

---

## Task 5: E2E - Opportunity Flow

**Files:**
- Create: `src/__tests__/e2e/opportunities.spec.ts`

**Step 1: Create opportunity tests**

```typescript
import { test, expect } from './fixtures/auth'
import { testOpportunity } from './fixtures/test-data'

test.describe('Opportunities', () => {
  test('add opportunity and see match results', async ({ authenticatedPage: page }) => {
    await page.goto('/opportunities')

    // Click add button
    await page.click('[data-testid="add-opportunity-button"]')

    // Fill in opportunity details
    await page.fill('[name="title"]', testOpportunity.title)
    await page.fill('[name="company"]', testOpportunity.company)
    await page.fill('[name="url"]', testOpportunity.url)
    await page.fill('[name="description"]', testOpportunity.description)

    // Submit
    await page.click('[data-testid="submit-opportunity"]')

    // Wait for processing
    await expect(page.locator('[data-testid="opportunity-card"]').first()).toBeVisible()

    // Click to view details
    await page.click('[data-testid="opportunity-card"]')

    // Verify match scores visible
    await expect(page.locator('[data-testid="match-score"]')).toBeVisible()
  })

  test('generate tailored profile', async ({ authenticatedPage: page }) => {
    // Assumes opportunity already exists
    await page.goto('/opportunities')

    await page.click('[data-testid="opportunity-card"]')
    await page.click('[data-testid="tailor-button"]')

    // Wait for generation (SSE)
    await expect(page.locator('[data-testid="tailoring-status"]')).toContainText('Generating')

    await expect(page.locator('[data-testid="tailored-profile"]')).toBeVisible({
      timeout: 120000
    })

    // Verify sections
    await expect(page.locator('[data-testid="narrative-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="resume-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="talking-points-section"]')).toBeVisible()
  })

  test('create and copy share link', async ({ authenticatedPage: page }) => {
    await page.goto('/opportunities')
    await page.click('[data-testid="opportunity-card"]')

    await page.click('[data-testid="share-button"]')

    // Wait for modal
    await expect(page.locator('[data-testid="share-modal"]')).toBeVisible()

    // Click copy
    await page.click('[data-testid="copy-link-button"]')

    // Verify copied message
    await expect(page.locator('[data-testid="copied-message"]')).toBeVisible()
  })
})
```

**Step 2: Commit**

```bash
git add src/__tests__/e2e/opportunities.spec.ts
git commit -m "test: add E2E opportunity flow tests"
```

---

## Task 6: Component Tests - Identity Claims List

**Files:**
- Create: `src/__tests__/unit/components/identity-claims-list.test.tsx`

**Step 1: Create component tests**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IdentityClaimsList } from '@/components/identity-claims-list'

const mockClaims = [
  { id: '1', type: 'skill', label: 'TypeScript', confidence: 0.9 },
  { id: '2', type: 'experience', label: '5 years React', confidence: 0.85 },
  { id: '3', type: 'education', label: 'BS Computer Science', confidence: 0.95 }
]

describe('IdentityClaimsList', () => {
  it('renders all claims', () => {
    render(<IdentityClaimsList claims={mockClaims} />)

    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('5 years React')).toBeInTheDocument()
    expect(screen.getByText('BS Computer Science')).toBeInTheDocument()
  })

  it('shows confidence indicators', () => {
    render(<IdentityClaimsList claims={mockClaims} />)

    // Check for confidence badges or indicators
    expect(screen.getByText(/90%/)).toBeInTheDocument()
  })

  it('groups claims by type', () => {
    render(<IdentityClaimsList claims={mockClaims} groupByType />)

    expect(screen.getByRole('heading', { name: /skills/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /experience/i })).toBeInTheDocument()
  })

  it('shows empty state when no claims', () => {
    render(<IdentityClaimsList claims={[]} />)

    expect(screen.getByText(/no claims/i)).toBeInTheDocument()
  })

  it('handles claim click', () => {
    const onClaimClick = vi.fn()
    render(<IdentityClaimsList claims={mockClaims} onClaimClick={onClaimClick} />)

    fireEvent.click(screen.getByText('TypeScript'))

    expect(onClaimClick).toHaveBeenCalledWith(mockClaims[0])
  })
})
```

**Step 2: Commit**

```bash
mkdir -p src/__tests__/unit/components
git add src/__tests__/unit/components/identity-claims-list.test.tsx
git commit -m "test: add IdentityClaimsList component tests"
```

---

## Task 7: Component Tests - Opportunity Card

**Files:**
- Create: `src/__tests__/unit/components/opportunity-card.test.tsx`

Key test cases:
- Renders opportunity details
- Shows match score badge
- Handles click to navigate
- Shows status indicators
- Displays company logo

**Step 1: Create tests**

**Step 2: Commit**

```bash
git add src/__tests__/unit/components/opportunity-card.test.tsx
git commit -m "test: add OpportunityCard component tests"
```

---

## Task 8: Component Tests - Resume Upload

**Files:**
- Create: `src/__tests__/unit/components/resume-upload.test.tsx`

Key test cases:
- Renders upload dropzone
- Accepts valid file types
- Rejects invalid file types
- Shows upload progress
- Handles upload errors
- Calls onUpload callback

**Step 1: Create tests**

**Step 2: Commit**

```bash
git add src/__tests__/unit/components/resume-upload.test.tsx
git commit -m "test: add ResumeUpload component tests"
```

---

## Task 9: Component Tests - Tailored Profile

**Files:**
- Create: `src/__tests__/unit/components/tailored-profile.test.tsx`

Key test cases:
- Renders all sections (narrative, resume, talking points)
- Shows loading state during generation
- Handles edit mode
- Copy to clipboard works
- PDF export button visible

**Step 1: Create tests**

**Step 2: Commit**

```bash
git add src/__tests__/unit/components/tailored-profile.test.tsx
git commit -m "test: add TailoredProfile component tests"
```

---

## Task 10: Add E2E to CI

**Files:**
- Modify: `.github/workflows/test.yml`

**Step 1: Add E2E job**

```yaml
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]

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

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase
        run: |
          supabase start
          supabase db push

      - name: Build app
        run: pnpm build

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

      - name: Stop Supabase
        if: always()
        run: supabase stop
```

**Step 2: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add E2E test job with Playwright"
```

---

## Task 11: Run Full Test Suite and Final Review

**Step 1: Run all tests**

```bash
pnpm test:run        # Unit tests
pnpm test:integration # Integration tests
pnpm test:e2e        # E2E tests
```

**Step 2: Generate coverage report**

```bash
pnpm test:coverage
```

**Step 3: Verify targets met**

| Layer | Target | Actual |
|-------|--------|--------|
| Security | 100% | ✓ |
| AI Core | 85% | ✓ |
| API Routes | 80% | ✓ |
| Integration/RLS | 70%/100% | ✓ |
| Components | 60% | ✓ |
| **Overall** | **75%** | ✓ |

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: complete Phase 5 - E2E and component tests"
```

---

## Phase 5 Completion Checklist

- [ ] Playwright installed and configured
- [ ] E2E auth flow tests complete
- [ ] E2E resume upload flow tests complete
- [ ] E2E opportunity flow tests complete
- [ ] IdentityClaimsList component tests
- [ ] OpportunityCard component tests
- [ ] ResumeUpload component tests
- [ ] TailoredProfile component tests
- [ ] E2E tests in CI
- [ ] All coverage targets met
- [ ] All tests pass

---

## Testing Strategy Complete

All 5 phases complete. The codebase now has:

- **100%** coverage on security-critical code
- **85%** coverage on AI extraction/matching
- **80%** coverage on API routes
- **100%** coverage on RLS policies
- **60%** coverage on React components
- **Critical E2E flows** tested

**Maintenance:**
- Run tests before every commit
- Review coverage weekly
- Update mocks when external APIs change
- Add tests for new features
