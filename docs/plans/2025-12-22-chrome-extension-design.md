# Chrome Extension Implementation Plan: Idynic Job Saver

**Status:** Implemented

**Goal:** Build a Chrome extension that saves job postings to Idynic with one click.

**Architecture:** Browser action popup reads current tab URL, sends to existing `/api/v1/opportunities` endpoint. Backend adds duplicate detection via normalized URLs and a verify endpoint for testing API keys.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS (no build step), Next.js API routes, Supabase/PostgreSQL

---

## Overview

A Chrome extension that saves job postings to Idynic with one click. Users navigate to a LinkedIn or job board page, click the extension icon, and the job is saved and enriched automatically.

## Decisions

| Aspect | Decision |
|--------|----------|
| Scope | LinkedIn + other job boards, URL-only |
| Trigger | Browser action button (click extension icon) |
| Auth | API key stored in chrome.storage.local |
| Feedback | Success toast with extracted title/company + link to opportunity |
| Errors | Clear guidance messages + paste fallback for scraping failures |
| Features | Save only (v1) |
| Duplicates | Normalized URL matching to prevent duplicates |

## Extension Architecture

```
idynic-chrome-extension/
├── manifest.json          # V3 manifest, permissions, service worker
├── popup/
│   ├── popup.html         # Small popup UI
│   ├── popup.css          # Minimal styling
│   └── popup.js           # Click handlers, API calls
├── options/
│   ├── options.html       # API key configuration page
│   └── options.js         # Save/load key from storage
├── icons/                 # 16, 48, 128px icons
└── lib/
    └── api.js             # Shared API client
```

### Permissions (Minimal)

- `activeTab` - Access current tab URL only when user clicks
- `storage` - Store API key securely
- Host permission for Idynic API domain only

No content scripts needed - extension only reads the current URL via `chrome.tabs.query()`.

### Data Flow

1. User clicks extension icon
2. Popup gets current tab URL
3. Sends `POST /api/v1/opportunities` with `{ url }`
4. Backend handles enrichment (LinkedIn → Bright Data, others → scraper)
5. Popup shows success + link to opportunity

## Popup UI States

### State 1: Not Configured
```
┌─────────────────────────┐
│  🔑 Connect to Idynic   │
│                         │
│  Paste your API key to  │
│  start saving jobs.     │
│                         │
│  [Open Settings]        │
└─────────────────────────┘
```

### State 2: Ready (default when configured)
```
┌─────────────────────────┐
│  Save to Idynic         │
│                         │
│  📍 linkedin.com/jobs.. │
│                         │
│  [Save Job]             │
└─────────────────────────┘
```

### State 3: Saving
```
┌─────────────────────────┐
│  Saving...              │
│                         │
│  ⏳ Extracting job info │
└─────────────────────────┘
```

### State 4: Success
```
┌─────────────────────────┐
│  ✓ Saved!               │
│                         │
│  Software Engineer      │
│  at Acme Corp           │
│                         │
│  [View in Idynic →]     │
└─────────────────────────┘
```

### State 5: Error (with fallback)
```
┌─────────────────────────┐
│  ⚠ Couldn't extract job │
│                         │
│  This page didn't look  │
│  like a job posting.    │
│                         │
│  [Paste description ↓]  │
│  ┌───────────────────┐  │
│  │                   │  │
│  └───────────────────┘  │
│  [Save with text]       │
└─────────────────────────┘
```

## Options Page

```
┌─────────────────────────────────────────┐
│  Idynic Extension Settings              │
├─────────────────────────────────────────┤
│                                         │
│  API Key                                │
│  ┌───────────────────────────────────┐  │
│  │ ••••••••••••••••••••              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Save]  [Test Connection]              │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  💡 Find your API key in Idynic at      │
│     Settings → API Keys                 │
│                                         │
│  [Open Idynic Settings →]               │
│                                         │
└─────────────────────────────────────────┘
```

Features:
- API key masked by default, toggle to reveal
- Test Connection button to verify key works
- Direct link to Idynic settings page

## API Integration

### Response Handling

| API Response | Extension Behavior |
|--------------|-------------------|
| `201` + opportunity data | Show success with title/company, link to `/opportunities/{id}` |
| `400` "Could not extract" | Show error state with paste fallback |
| `401` Unauthorized | Show "API key invalid" + link to settings |
| `409` Duplicate | Show "Already saved" + link to existing |
| `5xx` / Network error | Show "Connection error, try again" |

### Timeout

15-second timeout on API calls - Bright Data enrichment can take a few seconds.

## URL Normalization (Duplicate Detection)

To prevent saving the same job twice, URLs are normalized before comparison:

| Source | Canonical Form | Extract |
|--------|----------------|---------|
| LinkedIn | `linkedin:{jobId}` | Job ID from path (numbers only) |
| Greenhouse | `greenhouse:{company}:{id}` | Company + job ID |
| Lever | `lever:{company}:{id}` | Company + job ID |
| Other | `{hostname}{pathname}` | Strip query params, keep path |

```javascript
function normalizeJobUrl(url) {
  const parsed = new URL(url);

  // LinkedIn: extract job ID
  if (parsed.hostname.includes('linkedin.com')) {
    const match = parsed.pathname.match(/\/jobs\/view\/(\d+)/);
    if (match) return `linkedin:${match[1]}`;
  }

  // Greenhouse
  if (parsed.hostname.includes('greenhouse.io')) {
    const match = parsed.pathname.match(/\/(.+)\/jobs\/(\d+)/);
    if (match) return `greenhouse:${match[1]}:${match[2]}`;
  }

  // Lever
  if (parsed.hostname.includes('lever.co')) {
    const match = parsed.pathname.match(/\/([^\/]+)\/([a-f0-9-]+)/);
    if (match) return `lever:${match[1]}:${match[2]}`;
  }

  // Others: strip query params
  return `${parsed.hostname}${parsed.pathname}`;
}
```

## Manifest (V3)

```json
{
  "manifest_version": 3,
  "name": "Idynic Job Saver",
  "version": "1.0.0",
  "description": "Save jobs to Idynic with one click",

  "permissions": [
    "activeTab",
    "storage"
  ],

  "host_permissions": [
    "https://idynic.com/api/*"
  ],

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "options_page": "options/options.html",

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

## Backend Changes Required

### 1. New Endpoint: `GET /api/v1/auth/verify`

Lightweight endpoint to test API key validity:

```typescript
// src/app/api/v1/auth/verify/route.ts
export async function GET(request: Request) {
  const { userId, error } = await validateApiKey(request);
  if (error) return error;

  return NextResponse.json({ valid: true, user_id: userId });
}
```

### 2. Duplicate Detection in Opportunities Endpoint

Add to `POST /api/v1/opportunities` before insert:

```typescript
const normalizedUrl = normalizeJobUrl(url);

const { data: existing } = await supabase
  .from('opportunities')
  .select('id, title, company')
  .eq('user_id', userId)
  .eq('normalized_url', normalizedUrl)
  .single();

if (existing) {
  return NextResponse.json({
    duplicate: true,
    existing: existing
  }, { status: 409 });
}
```

### 3. Database Migration

```sql
-- Add normalized_url column
ALTER TABLE opportunities
ADD COLUMN normalized_url text;

-- Index for fast duplicate lookups
CREATE INDEX idx_opportunities_normalized_url
ON opportunities(user_id, normalized_url);
```

### 4. Backfill Existing Opportunities

One-time script to populate `normalized_url` for existing records.

## Security

- API key stored in `chrome.storage.local` (sandboxed, encrypted at rest by Chrome)
- Key only transmitted over HTTPS to Idynic API
- Extension permissions scoped minimally (no broad host access)
- No content scripts - no page injection

## Future Enhancements (Not in v1)

- Auto-detect job pages and show subtle prompt
- Recent saves list in popup
- Status updates from extension
- Chrome Web Store distribution

---

# Implementation Tasks

## Task 1: Add `normalized_url` Column Migration

**Files:**
- Create: `supabase/migrations/[timestamp]_add_normalized_url.sql`

**Step 1: Create the migration file**

```sql
-- Add normalized_url column for duplicate detection
ALTER TABLE opportunities
ADD COLUMN normalized_url text;

-- Index for fast duplicate lookups by user
CREATE INDEX idx_opportunities_normalized_url
ON opportunities(user_id, normalized_url);

-- Backfill existing opportunities with normalized URLs
UPDATE opportunities
SET normalized_url = CASE
  -- LinkedIn: extract job ID
  WHEN url LIKE '%linkedin.com/jobs/view/%' THEN
    'linkedin:' || regexp_replace(url, '.*linkedin\.com/jobs/view/(\d+).*', '\1')
  -- Greenhouse
  WHEN url LIKE '%greenhouse.io%' THEN
    'greenhouse:' || regexp_replace(url, '.*boards\.greenhouse\.io/([^/]+)/jobs/(\d+).*', '\1:\2')
  -- Lever
  WHEN url LIKE '%lever.co%' THEN
    'lever:' || regexp_replace(url, '.*jobs\.lever\.co/([^/]+)/([a-f0-9-]+).*', '\1:\2')
  -- Other URLs: hostname + path (strip query params)
  WHEN url IS NOT NULL THEN
    regexp_replace(url, '^https?://([^?]+).*', '\1')
  ELSE NULL
END
WHERE url IS NOT NULL;
```

**Step 2: Apply migration**

Run: `pnpm supabase migration up` (or via MCP tool)

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add normalized_url column for duplicate detection"
```

---

## Task 2: Add URL Normalization Utility

**Files:**
- Create: `src/lib/utils/normalize-url.ts`
- Create: `src/lib/utils/__tests__/normalize-url.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/utils/__tests__/normalize-url.test.ts
import { normalizeJobUrl } from '../normalize-url';

describe('normalizeJobUrl', () => {
  describe('LinkedIn URLs', () => {
    it('extracts job ID from LinkedIn URL', () => {
      const url = 'https://www.linkedin.com/jobs/view/3847291034';
      expect(normalizeJobUrl(url)).toBe('linkedin:3847291034');
    });

    it('strips tracking params from LinkedIn URL', () => {
      const url = 'https://www.linkedin.com/jobs/view/3847291034?refId=abc&trackingId=xyz&trk=jobs_list';
      expect(normalizeJobUrl(url)).toBe('linkedin:3847291034');
    });

    it('handles LinkedIn URLs with trailing slash', () => {
      const url = 'https://linkedin.com/jobs/view/3847291034/';
      expect(normalizeJobUrl(url)).toBe('linkedin:3847291034');
    });
  });

  describe('Greenhouse URLs', () => {
    it('extracts company and job ID from Greenhouse URL', () => {
      const url = 'https://boards.greenhouse.io/acme/jobs/4567890';
      expect(normalizeJobUrl(url)).toBe('greenhouse:acme:4567890');
    });

    it('strips query params from Greenhouse URL', () => {
      const url = 'https://boards.greenhouse.io/acme/jobs/4567890?gh_jid=4567890';
      expect(normalizeJobUrl(url)).toBe('greenhouse:acme:4567890');
    });
  });

  describe('Lever URLs', () => {
    it('extracts company and job ID from Lever URL', () => {
      const url = 'https://jobs.lever.co/acme/a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(normalizeJobUrl(url)).toBe('lever:acme:a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });
  });

  describe('Other URLs', () => {
    it('strips query params and keeps hostname + path', () => {
      const url = 'https://careers.example.com/jobs/senior-engineer?ref=twitter';
      expect(normalizeJobUrl(url)).toBe('careers.example.com/jobs/senior-engineer');
    });

    it('handles URLs without query params', () => {
      const url = 'https://jobs.company.com/posting/12345';
      expect(normalizeJobUrl(url)).toBe('jobs.company.com/posting/12345');
    });
  });

  describe('edge cases', () => {
    it('returns null for null input', () => {
      expect(normalizeJobUrl(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(normalizeJobUrl(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(normalizeJobUrl('')).toBeNull();
    });

    it('returns null for invalid URL', () => {
      expect(normalizeJobUrl('not-a-url')).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/utils/__tests__/normalize-url.test.ts`

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/utils/normalize-url.ts

/**
 * Normalize a job URL for duplicate detection.
 * Extracts canonical identifiers from known job boards,
 * strips tracking params from others.
 */
export function normalizeJobUrl(url: string | null | undefined): string | null {
  if (!url || url.trim() === '') {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // LinkedIn: extract job ID
  if (parsed.hostname.includes('linkedin.com')) {
    const match = parsed.pathname.match(/\/jobs\/view\/(\d+)/);
    if (match) {
      return `linkedin:${match[1]}`;
    }
  }

  // Greenhouse: extract company + job ID
  if (parsed.hostname.includes('greenhouse.io')) {
    const match = parsed.pathname.match(/\/([^/]+)\/jobs\/(\d+)/);
    if (match) {
      return `greenhouse:${match[1]}:${match[2]}`;
    }
  }

  // Lever: extract company + job ID
  if (parsed.hostname.includes('lever.co')) {
    const match = parsed.pathname.match(/\/([^/]+)\/([a-f0-9-]+)/);
    if (match) {
      return `lever:${match[1]}:${match[2]}`;
    }
  }

  // Other URLs: strip query params, keep hostname + path
  const path = parsed.pathname.replace(/\/$/, ''); // Remove trailing slash
  return `${parsed.hostname}${path}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/utils/__tests__/normalize-url.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/utils/normalize-url.ts src/lib/utils/__tests__/normalize-url.test.ts
git commit -m "feat: add URL normalization utility for duplicate detection"
```

---

## Task 3: Add Duplicate Detection to Opportunities Endpoint

**Files:**
- Modify: `src/app/api/v1/opportunities/route.ts`
- Create: `src/app/api/v1/opportunities/__tests__/duplicate-detection.test.ts`

**Step 1: Write the failing test**

```typescript
// src/app/api/v1/opportunities/__tests__/duplicate-detection.test.ts
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/api/auth', () => ({
  validateApiKey: jest.fn().mockResolvedValue({ userId: 'test-user-id', keyId: 'test-key-id' }),
  isAuthError: jest.fn().mockReturnValue(false),
}));

jest.mock('openai');
jest.mock('@/lib/ai/embeddings');
jest.mock('@/lib/integrations/brightdata');
jest.mock('@/lib/integrations/scraping');
jest.mock('@/lib/ai/research-company-background');

import { createServiceRoleClient } from '@/lib/supabase/service-role';

describe('POST /api/v1/opportunities - duplicate detection', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createServiceRoleClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('returns 409 with existing opportunity when duplicate URL found', async () => {
    // First query for duplicate check returns existing opportunity
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'existing-id', title: 'Software Engineer', company: 'Acme Corp' },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/v1/opportunities', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://www.linkedin.com/jobs/view/3847291034',
        description: 'Test job description',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe('duplicate');
    expect(data.data.existing.id).toBe('existing-id');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/api/v1/opportunities/__tests__/duplicate-detection.test.ts`

Expected: FAIL - no 409 response, returns 201

**Step 3: Modify opportunities route to add duplicate check**

Add import at top of `src/app/api/v1/opportunities/route.ts`:

```typescript
import { normalizeJobUrl } from '@/lib/utils/normalize-url';
```

Add duplicate check after auth validation, before LinkedIn enrichment (around line 117):

```typescript
    // Check for duplicate URL
    if (url) {
      const normalizedUrl = normalizeJobUrl(url);
      if (normalizedUrl) {
        const { data: existing } = await supabase
          .from('opportunities')
          .select('id, title, company')
          .eq('user_id', userId)
          .eq('normalized_url', normalizedUrl)
          .single();

        if (existing) {
          return NextResponse.json(
            {
              error: {
                code: 'duplicate',
                message: 'You have already saved this job',
                request_id: crypto.randomUUID().slice(0, 8),
              },
              data: { existing },
            },
            { status: 409 }
          );
        }
      }
    }
```

Add `normalized_url` to the insert (around line 248):

```typescript
    // Insert opportunity with LinkedIn metadata
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert({
        user_id: userId,
        title: finalTitle,
        company: finalCompany,
        url: url || null,
        normalized_url: url ? normalizeJobUrl(url) : null,  // ADD THIS LINE
        description: finalDescription,
        // ... rest of fields
      })
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/app/api/v1/opportunities/__tests__/duplicate-detection.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/v1/opportunities/route.ts src/app/api/v1/opportunities/__tests__/
git commit -m "feat: add duplicate detection to opportunities endpoint"
```

---

## Task 4: Create Auth Verify Endpoint

**Files:**
- Create: `src/app/api/v1/auth/verify/route.ts`
- Create: `src/app/api/v1/auth/verify/__tests__/route.test.ts`

**Step 1: Write the failing test**

```typescript
// src/app/api/v1/auth/verify/__tests__/route.test.ts
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { validateApiKey, isAuthError } from '@/lib/api/auth';

jest.mock('@/lib/api/auth');

describe('GET /api/v1/auth/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns valid:true when API key is valid', async () => {
    (validateApiKey as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      keyId: 'key-456',
    });
    (isAuthError as jest.Mock).mockReturnValue(false);

    const request = new NextRequest('http://localhost/api/v1/auth/verify', {
      headers: { Authorization: 'Bearer idn_test_key' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.valid).toBe(true);
    expect(data.data.user_id).toBe('user-123');
  });

  it('returns 401 when API key is invalid', async () => {
    const errorResponse = new Response(
      JSON.stringify({ error: { code: 'invalid_api_key', message: 'Invalid' } }),
      { status: 401 }
    );
    (validateApiKey as jest.Mock).mockResolvedValue(errorResponse);
    (isAuthError as jest.Mock).mockReturnValue(true);

    const request = new NextRequest('http://localhost/api/v1/auth/verify', {
      headers: { Authorization: 'Bearer invalid_key' },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/api/v1/auth/verify/__tests__/route.test.ts`

Expected: FAIL - module not found

**Step 3: Write the implementation**

```typescript
// src/app/api/v1/auth/verify/route.ts
import { NextRequest } from 'next/server';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess } from '@/lib/api/response';

/**
 * GET /api/v1/auth/verify
 *
 * Verify that an API key is valid.
 * Used by the Chrome extension to test connection.
 */
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);

  if (isAuthError(authResult)) {
    return authResult;
  }

  return apiSuccess({
    valid: true,
    user_id: authResult.userId,
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/app/api/v1/auth/verify/__tests__/route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/v1/auth/verify/
git commit -m "feat: add /api/v1/auth/verify endpoint for extension connection testing"
```

---

## Task 5: Create Chrome Extension Directory Structure

**Files:**
- Create: `chrome-extension/manifest.json`
- Create: `chrome-extension/icons/` (copy from public/)

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Idynic Job Saver",
  "version": "1.0.0",
  "description": "Save jobs to Idynic with one click",

  "permissions": [
    "activeTab",
    "storage"
  ],

  "host_permissions": [
    "https://idynic.com/*",
    "http://localhost:3000/*"
  ],

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "options_page": "options/options.html",

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Step 2: Copy icons from public/**

```bash
mkdir -p chrome-extension/icons
cp public/favicon-16x16.png chrome-extension/icons/icon16.png
cp public/favicon-48x48.png chrome-extension/icons/icon48.png
cp public/favicon-128x128.png chrome-extension/icons/icon128.png
```

**Step 3: Create placeholder directories**

```bash
mkdir -p chrome-extension/popup
mkdir -p chrome-extension/options
mkdir -p chrome-extension/lib
```

**Step 4: Commit**

```bash
git add chrome-extension/
git commit -m "feat: create Chrome extension directory structure with manifest"
```

---

## Task 6: Create API Client Library

**Files:**
- Create: `chrome-extension/lib/api.js`

**Step 1: Create the API client**

```javascript
// chrome-extension/lib/api.js

const API_BASE_PROD = 'https://idynic.com';
const API_BASE_DEV = 'http://localhost:3000';

/**
 * Get the API base URL (dev or prod)
 */
function getApiBase() {
  // Use dev URL if in development mode (can be toggled in options)
  return API_BASE_PROD;
}

/**
 * Get stored API key from chrome.storage
 */
async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  return result.apiKey || null;
}

/**
 * Save API key to chrome.storage
 */
async function saveApiKey(apiKey) {
  await chrome.storage.local.set({ apiKey });
}

/**
 * Clear stored API key
 */
async function clearApiKey() {
  await chrome.storage.local.remove('apiKey');
}

/**
 * Verify API key is valid
 * @returns {Promise<{valid: boolean, user_id?: string, error?: string}>}
 */
async function verifyApiKey(apiKey) {
  try {
    const response = await fetch(`${getApiBase()}/api/v1/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, user_id: data.data.user_id };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: false, error: 'Connection error' };
  } catch (error) {
    return { valid: false, error: 'Network error - check your connection' };
  }
}

/**
 * Save an opportunity
 * @param {string} url - The job posting URL
 * @param {string|null} description - Optional job description
 * @returns {Promise<{success: boolean, data?: object, error?: {code: string, message: string}}>}
 */
async function saveOpportunity(url, description = null) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    return { success: false, error: { code: 'no_api_key', message: 'API key not configured' } };
  }

  try {
    const body = { url };
    if (description) {
      body.description = description;
    }

    const response = await fetch(`${getApiBase()}/api/v1/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data: data.data };
    }

    // Handle specific error codes
    if (response.status === 409) {
      return {
        success: false,
        error: { code: 'duplicate', message: 'Already saved' },
        existing: data.data?.existing,
      };
    }

    if (response.status === 401) {
      return { success: false, error: { code: 'unauthorized', message: 'API key invalid' } };
    }

    if (response.status === 400 && data.error?.code === 'scraping_failed') {
      return { success: false, error: { code: 'scraping_failed', message: data.error.message } };
    }

    return { success: false, error: { code: 'unknown', message: data.error?.message || 'Unknown error' } };
  } catch (error) {
    return { success: false, error: { code: 'network', message: 'Network error - try again' } };
  }
}

// Export for use in popup and options
window.IdynicApi = {
  getApiKey,
  saveApiKey,
  clearApiKey,
  verifyApiKey,
  saveOpportunity,
  getApiBase,
};
```

**Step 2: Commit**

```bash
git add chrome-extension/lib/api.js
git commit -m "feat: add Chrome extension API client library"
```

---

## Task 7: Create Options Page

**Files:**
- Create: `chrome-extension/options/options.html`
- Create: `chrome-extension/options/options.css`
- Create: `chrome-extension/options/options.js`

**Step 1: Create options.html**

```html
<!-- chrome-extension/options/options.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Idynic Extension Settings</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="container">
    <header>
      <img src="../icons/icon48.png" alt="Idynic" class="logo">
      <h1>Idynic Extension Settings</h1>
    </header>

    <main>
      <section class="form-section">
        <label for="api-key">API Key</label>
        <div class="input-group">
          <input
            type="password"
            id="api-key"
            placeholder="idn_..."
            autocomplete="off"
          >
          <button type="button" id="toggle-visibility" class="icon-btn" title="Show/hide">
            👁
          </button>
        </div>

        <div class="button-group">
          <button type="button" id="save-btn" class="primary">Save</button>
          <button type="button" id="test-btn" class="secondary">Test Connection</button>
        </div>

        <div id="status" class="status hidden"></div>
      </section>

      <section class="help-section">
        <p>Find your API key in Idynic at <strong>Settings → API Keys</strong></p>
        <a href="https://idynic.com/settings/api-keys" target="_blank" class="link">
          Open Idynic Settings →
        </a>
      </section>
    </main>
  </div>

  <script src="../lib/api.js"></script>
  <script src="options.js"></script>
</body>
</html>
```

**Step 2: Create options.css**

```css
/* chrome-extension/options/options.css */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a1a;
  background: #f5f5f5;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

.container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 32px;
  width: 100%;
  max-width: 480px;
}

header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.logo {
  width: 48px;
  height: 48px;
}

h1 {
  font-size: 20px;
  font-weight: 600;
}

.form-section {
  margin-bottom: 24px;
}

label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
}

.input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

input[type="password"],
input[type="text"] {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: monospace;
}

input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.icon-btn {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 16px;
}

.icon-btn:hover {
  background: #f5f5f5;
}

.button-group {
  display: flex;
  gap: 12px;
}

button {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

button.primary {
  background: #3b82f6;
  color: white;
  border: none;
}

button.primary:hover {
  background: #2563eb;
}

button.secondary {
  background: white;
  color: #374151;
  border: 1px solid #ddd;
}

button.secondary:hover {
  background: #f5f5f5;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status {
  margin-top: 16px;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
}

.status.hidden {
  display: none;
}

.status.success {
  background: #dcfce7;
  color: #166534;
}

.status.error {
  background: #fee2e2;
  color: #991b1b;
}

.status.info {
  background: #dbeafe;
  color: #1e40af;
}

.help-section {
  padding-top: 24px;
  border-top: 1px solid #eee;
  color: #666;
}

.help-section p {
  margin-bottom: 8px;
}

.link {
  color: #3b82f6;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}
```

**Step 3: Create options.js**

```javascript
// chrome-extension/options/options.js

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const toggleBtn = document.getElementById('toggle-visibility');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const statusEl = document.getElementById('status');

  // Load existing API key
  const existingKey = await IdynicApi.getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
  }

  // Toggle password visibility
  toggleBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleBtn.textContent = '👁';
    }
  });

  // Show status message
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  // Save API key
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    if (!apiKey.startsWith('idn_')) {
      showStatus('API key should start with "idn_"', 'error');
      return;
    }

    await IdynicApi.saveApiKey(apiKey);
    showStatus('Saved!', 'success');

    // Clear success message after 2 seconds
    setTimeout(() => {
      statusEl.className = 'status hidden';
    }, 2000);
  });

  // Test connection
  testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter an API key first', 'error');
      return;
    }

    showStatus('Testing connection...', 'info');
    testBtn.disabled = true;

    const result = await IdynicApi.verifyApiKey(apiKey);

    testBtn.disabled = false;

    if (result.valid) {
      showStatus('Connection successful!', 'success');
    } else {
      showStatus(result.error || 'Connection failed', 'error');
    }
  });
});
```

**Step 4: Commit**

```bash
git add chrome-extension/options/
git commit -m "feat: add Chrome extension options page for API key setup"
```

---

## Task 8: Create Popup UI

**Files:**
- Create: `chrome-extension/popup/popup.html`
- Create: `chrome-extension/popup/popup.css`
- Create: `chrome-extension/popup/popup.js`

**Step 1: Create popup.html**

```html
<!-- chrome-extension/popup/popup.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Idynic</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <!-- State: Not Configured -->
    <div id="state-unconfigured" class="state hidden">
      <div class="icon">🔑</div>
      <h2>Connect to Idynic</h2>
      <p>Paste your API key to start saving jobs.</p>
      <button id="open-settings" class="primary">Open Settings</button>
    </div>

    <!-- State: Ready -->
    <div id="state-ready" class="state hidden">
      <h2>Save to Idynic</h2>
      <div class="url-preview">
        <span class="url-icon">📍</span>
        <span id="current-url" class="url-text"></span>
      </div>
      <button id="save-btn" class="primary">Save Job</button>
    </div>

    <!-- State: Saving -->
    <div id="state-saving" class="state hidden">
      <div class="spinner"></div>
      <h2>Saving...</h2>
      <p>Extracting job info</p>
    </div>

    <!-- State: Success -->
    <div id="state-success" class="state hidden">
      <div class="icon success">✓</div>
      <h2>Saved!</h2>
      <div id="job-info" class="job-info">
        <div id="job-title" class="job-title"></div>
        <div id="job-company" class="job-company"></div>
      </div>
      <a id="view-link" href="#" target="_blank" class="primary link-btn">View in Idynic →</a>
    </div>

    <!-- State: Duplicate -->
    <div id="state-duplicate" class="state hidden">
      <div class="icon info">ℹ</div>
      <h2>Already Saved</h2>
      <div id="dup-job-info" class="job-info">
        <div id="dup-job-title" class="job-title"></div>
        <div id="dup-job-company" class="job-company"></div>
      </div>
      <a id="dup-view-link" href="#" target="_blank" class="primary link-btn">View in Idynic →</a>
    </div>

    <!-- State: Error -->
    <div id="state-error" class="state hidden">
      <div class="icon error">⚠</div>
      <h2 id="error-title">Couldn't extract job</h2>
      <p id="error-message">This page didn't look like a job posting.</p>

      <div id="fallback-section" class="fallback hidden">
        <textarea id="fallback-description" placeholder="Paste the job description here..."></textarea>
        <button id="save-with-text" class="secondary">Save with text</button>
      </div>

      <button id="show-fallback" class="secondary">Paste description instead</button>
      <button id="retry-btn" class="text-btn hidden">Try again</button>
    </div>
  </div>

  <script src="../lib/api.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Create popup.css**

```css
/* chrome-extension/popup/popup.css */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a1a;
  width: 320px;
}

.container {
  padding: 20px;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.state.hidden {
  display: none;
}

.icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.icon.success {
  color: #16a34a;
}

.icon.error {
  color: #dc2626;
}

.icon.info {
  color: #3b82f6;
}

h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

p {
  color: #666;
  margin-bottom: 16px;
}

button {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

button.primary {
  background: #3b82f6;
  color: white;
}

button.primary:hover {
  background: #2563eb;
}

button.secondary {
  background: #f3f4f6;
  color: #374151;
  margin-top: 8px;
}

button.secondary:hover {
  background: #e5e7eb;
}

button.text-btn {
  background: transparent;
  color: #3b82f6;
  margin-top: 8px;
}

button.text-btn:hover {
  text-decoration: underline;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.link-btn {
  display: block;
  text-decoration: none;
  text-align: center;
}

.url-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f3f4f6;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  width: 100%;
}

.url-icon {
  flex-shrink: 0;
}

.url-text {
  color: #666;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-info {
  background: #f3f4f6;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  width: 100%;
}

.job-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.job-company {
  color: #666;
  font-size: 13px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fallback {
  width: 100%;
  margin-top: 16px;
}

.fallback.hidden {
  display: none;
}

textarea {
  width: 100%;
  height: 120px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 8px;
}

textarea:focus {
  outline: none;
  border-color: #3b82f6;
}
```

**Step 3: Create popup.js**

```javascript
// chrome-extension/popup/popup.js

// State elements
const states = {
  unconfigured: document.getElementById('state-unconfigured'),
  ready: document.getElementById('state-ready'),
  saving: document.getElementById('state-saving'),
  success: document.getElementById('state-success'),
  duplicate: document.getElementById('state-duplicate'),
  error: document.getElementById('state-error'),
};

// UI elements
const currentUrlEl = document.getElementById('current-url');
const jobTitleEl = document.getElementById('job-title');
const jobCompanyEl = document.getElementById('job-company');
const dupJobTitleEl = document.getElementById('dup-job-title');
const dupJobCompanyEl = document.getElementById('dup-job-company');
const viewLinkEl = document.getElementById('view-link');
const dupViewLinkEl = document.getElementById('dup-view-link');
const errorTitleEl = document.getElementById('error-title');
const errorMessageEl = document.getElementById('error-message');
const fallbackSection = document.getElementById('fallback-section');
const fallbackDescription = document.getElementById('fallback-description');

// Current tab URL
let currentUrl = '';

/**
 * Show a specific state, hide others
 */
function showState(stateName) {
  Object.keys(states).forEach(key => {
    states[key].classList.toggle('hidden', key !== stateName);
  });
}

/**
 * Get the base URL for Idynic
 */
function getIdynicUrl() {
  return IdynicApi.getApiBase();
}

/**
 * Truncate URL for display
 */
function truncateUrl(url, maxLength = 40) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

/**
 * Initialize popup
 */
async function init() {
  // Check if API key is configured
  const apiKey = await IdynicApi.getApiKey();

  if (!apiKey) {
    showState('unconfigured');
    return;
  }

  // Get current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url || '';

  if (!currentUrl || currentUrl.startsWith('chrome://')) {
    showState('error');
    errorTitleEl.textContent = 'Not a job page';
    errorMessageEl.textContent = 'Navigate to a job posting to save it.';
    document.getElementById('show-fallback').classList.add('hidden');
    return;
  }

  // Show ready state with URL
  currentUrlEl.textContent = truncateUrl(currentUrl);
  showState('ready');
}

/**
 * Save the current job
 */
async function saveJob(description = null) {
  showState('saving');

  const result = await IdynicApi.saveOpportunity(currentUrl, description);

  if (result.success) {
    // Success!
    jobTitleEl.textContent = result.data.title || 'Job';
    jobCompanyEl.textContent = result.data.company ? `at ${result.data.company}` : '';
    viewLinkEl.href = `${getIdynicUrl()}/opportunities/${result.data.id}`;
    showState('success');
    return;
  }

  // Handle specific errors
  if (result.error.code === 'duplicate') {
    dupJobTitleEl.textContent = result.existing?.title || 'Job';
    dupJobCompanyEl.textContent = result.existing?.company ? `at ${result.existing.company}` : '';
    dupViewLinkEl.href = `${getIdynicUrl()}/opportunities/${result.existing?.id}`;
    showState('duplicate');
    return;
  }

  if (result.error.code === 'unauthorized') {
    showState('unconfigured');
    return;
  }

  if (result.error.code === 'scraping_failed') {
    errorTitleEl.textContent = "Couldn't extract job";
    errorMessageEl.textContent = result.error.message;
    document.getElementById('show-fallback').classList.remove('hidden');
    showState('error');
    return;
  }

  // Generic error
  errorTitleEl.textContent = 'Something went wrong';
  errorMessageEl.textContent = result.error.message;
  document.getElementById('show-fallback').classList.add('hidden');
  document.getElementById('retry-btn').classList.remove('hidden');
  showState('error');
}

// Event listeners
document.getElementById('open-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('save-btn').addEventListener('click', () => {
  saveJob();
});

document.getElementById('show-fallback').addEventListener('click', () => {
  fallbackSection.classList.remove('hidden');
  document.getElementById('show-fallback').classList.add('hidden');
  fallbackDescription.focus();
});

document.getElementById('save-with-text').addEventListener('click', () => {
  const description = fallbackDescription.value.trim();
  if (!description) {
    fallbackDescription.focus();
    return;
  }
  saveJob(description);
});

document.getElementById('retry-btn').addEventListener('click', () => {
  saveJob();
});

// Initialize on load
init();
```

**Step 4: Commit**

```bash
git add chrome-extension/popup/
git commit -m "feat: add Chrome extension popup UI with all states"
```

---

## Task 9: Test Extension Locally

**Step 1: Load extension in Chrome**

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension/` directory
5. The extension should appear with the Idynic icon

**Step 2: Test configuration flow**

1. Click the extension icon
2. Should show "Connect to Idynic" state
3. Click "Open Settings"
4. Enter a valid API key
5. Click "Test Connection" - should show success
6. Click "Save"

**Step 3: Test save flow**

1. Navigate to a LinkedIn job page: `https://www.linkedin.com/jobs/view/...`
2. Click the extension icon
3. Should show the URL and "Save Job" button
4. Click "Save Job"
5. Should show success with job title and link

**Step 4: Test duplicate detection**

1. Click the extension icon on the same job page
2. Should show "Already Saved" with link to existing opportunity

**Step 5: Test error fallback**

1. Navigate to a non-job page (e.g., `https://example.com`)
2. Click the extension icon
3. Click "Paste description instead"
4. Paste a job description
5. Click "Save with text"
6. Should save successfully

**Step 6: Commit any fixes**

```bash
git add chrome-extension/
git commit -m "fix: polish Chrome extension based on testing"
```

---

## Task 10: Update Design Doc and Final Commit

**Step 1: Update design doc status**

Update the status at the top of `docs/plans/2025-12-22-chrome-extension-design.md`:

```markdown
**Status:** Implemented
```

**Step 2: Create final commit**

```bash
git add .
git commit -m "feat: complete Chrome extension for saving jobs to Idynic

- Add normalized_url column for duplicate detection
- Add URL normalization utility with tests
- Add duplicate detection to opportunities endpoint
- Add /api/v1/auth/verify endpoint
- Create Chrome extension with popup and options page
- Support LinkedIn and generic job board URLs

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add normalized_url migration | `supabase/migrations/` |
| 2 | URL normalization utility | `src/lib/utils/normalize-url.ts` |
| 3 | Duplicate detection | `src/app/api/v1/opportunities/route.ts` |
| 4 | Auth verify endpoint | `src/app/api/v1/auth/verify/route.ts` |
| 5 | Extension structure | `chrome-extension/manifest.json`, icons |
| 6 | API client | `chrome-extension/lib/api.js` |
| 7 | Options page | `chrome-extension/options/` |
| 8 | Popup UI | `chrome-extension/popup/` |
| 9 | Local testing | Manual verification |
| 10 | Final commit | Documentation update |
