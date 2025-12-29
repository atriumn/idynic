# Phase 3: Chrome Extension Tests

**Priority**: HIGH
**Effort**: 1-2 days
**Status**: Not Started

## Progress (Last reviewed: 2025-12-29)

| Step | Status | Notes |
|------|--------|-------|
| Step 1-13: All steps | ⏳ Not Started | Can run in parallel with Phase 1-2 |

### Drift Notes
- No implementation started yet
- Independent of Phase 1-2, can be implemented anytime

## Overview

Add unit tests to the Chrome extension, which currently has zero test coverage. Focus on content script logic (job parsing), background service worker (API communication), and popup components.

## Prerequisites

- [ ] Chrome extension codebase exists (`chrome-extension/`)
- [ ] Extension builds successfully (`pnpm build` in chrome-extension)
- [ ] Understanding of extension architecture (content scripts, background, popup)

## Steps

### Step 1: Install Test Dependencies

**Effort**: 15 min

```bash
cd chrome-extension
pnpm add -D jest ts-jest @types/jest jest-environment-jsdom @testing-library/dom @testing-library/jest-dom
```

**Done when**: Dependencies installed

---

### Step 2: Create Jest Config

**Effort**: 30 min

Create `chrome-extension/jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  }
}
```

**Done when**: `npx jest --version` works

---

### Step 3: Create Jest Setup File

**Effort**: 45 min

Create `chrome-extension/jest.setup.js`:
- Mock `chrome.runtime` API (sendMessage, onMessage, getURL)
- Mock `chrome.storage` API (local, sync)
- Mock `chrome.tabs` API (query, sendMessage)
- Import `@testing-library/jest-dom`

**Done when**: Setup file created with all Chrome API mocks

---

### Step 4: Create Test Directory Structure

**Effort**: 10 min

```bash
mkdir -p chrome-extension/src/__tests__/content-script
mkdir -p chrome-extension/src/__tests__/background
mkdir -p chrome-extension/src/__tests__/popup
mkdir -p chrome-extension/src/__tests__/utils
```

**Done when**: Directories exist

---

### Step 5: Write Job Parser Tests

**Effort**: 2 hours

Create `chrome-extension/src/__tests__/content-script/job-parser.test.ts`:
- Test LinkedIn job page parsing
- Test Indeed job page parsing
- Test Greenhouse job page parsing
- Test handling of non-job pages (returns null)
- Test handling of malformed HTML

**Done when**: Parser tests cover all supported job sites

---

### Step 6: Write Page Detection Tests

**Effort**: 1 hour

Create `chrome-extension/src/__tests__/content-script/page-detection.test.ts`:
- Test detection of LinkedIn job pages
- Test detection of Indeed job pages
- Test detection of other supported sites
- Test non-job pages are not detected

**Done when**: Page detection logic fully tested

---

### Step 7: Write Background API Client Tests

**Effort**: 1.5 hours

Create `chrome-extension/src/__tests__/background/api-client.test.ts`:
- Test successful job submission to API
- Test error handling (network errors, API errors)
- Test authentication header included
- Test request payload format

Mock `fetch` for all tests.

**Done when**: API client tests cover success and error cases

---

### Step 8: Write Message Handler Tests

**Effort**: 1 hour

Create `chrome-extension/src/__tests__/background/message-handler.test.ts`:
- Test handling of "capture job" message
- Test handling of "get status" message
- Test unknown message types
- Test response format

**Done when**: Message handler fully tested

---

### Step 9: Write Storage Utility Tests

**Effort**: 45 min

Create `chrome-extension/src/__tests__/utils/storage.test.ts`:
- Test storing API key
- Test retrieving API key
- Test storing/retrieving user preferences
- Test handling of missing values

**Done when**: Storage utilities fully tested

---

### Step 10: Write Popup Component Tests (if React)

**Effort**: 1 hour (skip if popup is simple HTML)

If popup uses React:
- Create `chrome-extension/src/__tests__/popup/` tests
- Test login state display
- Test capture button functionality
- Test settings panel

**Done when**: Popup components tested (or skipped if not React)

---

### Step 11: Add Package.json Scripts

**Effort**: 15 min

Add to `chrome-extension/package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Done when**: `pnpm test` runs all extension tests

---

### Step 12: Update Root Package.json

**Effort**: 10 min

Add to root `package.json`:

```json
{
  "scripts": {
    "test:extension": "pnpm --filter chrome-extension test"
  }
}
```

**Done when**: `pnpm test:extension` works from repo root

---

### Step 13: Update CI Workflow

**Effort**: 30 min

Update `.github/workflows/test.yml`:
- Add Chrome extension test step
- Run after lint, before other tests
- Include coverage reporting

**Done when**: Extension tests run in CI

---

## Acceptance Criteria

- [ ] `pnpm test:extension` runs all Chrome extension tests
- [ ] Job parser tests cover all supported sites
- [ ] API client tests cover success and error paths
- [ ] Chrome APIs properly mocked
- [ ] Coverage threshold met (50%+)
- [ ] Tests run in CI
- [ ] Total test count: 15-25 tests

## Dependencies

- None (can run in parallel with Phase 1-2)

## Outputs

- `chrome-extension/jest.config.js`
- `chrome-extension/jest.setup.js`
- `chrome-extension/src/__tests__/` directory with tests
- Updated `.github/workflows/test.yml`
