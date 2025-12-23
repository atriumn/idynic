# Chrome Extension Design: Idynic Job Saver

**Date:** 2025-12-22
**Status:** Approved

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
