# Generic Job URL Scraping

**Status:** Implemented

## Overview

Scrape job postings from any URL (Indeed, Glassdoor, company career pages, etc.) using a cascading fallback approach. LinkedIn URLs continue to use Bright Data's dedicated scraper for rich structured data.

## Problem

Currently, only LinkedIn job URLs are enriched. Users pasting Indeed, Glassdoor, or company career page URLs must also provide the job description manually.

## Solution

For non-LinkedIn job URLs:
1. Try Jina Reader (free) to fetch page content as markdown
2. If fails, try Bright Data Web Unlocker (paid fallback)
3. If still fails, return error asking user to paste description

LinkedIn URLs continue using the dedicated Bright Data LinkedIn Jobs scraper for structured metadata (salary, applicants, seniority, etc.).

---

## Technical Design

### Scraping Chain

```
isLinkedInJobUrl(url)?
  → Yes: Use fetchLinkedInJob() (existing, structured data)
  → No: Use fetchJobPageContent() (new, generic scraping)
        1. Try Jina Reader
        2. Fallback to Bright Data Web Unlocker
        3. Return null if both fail
```

### New Function: `fetchJobPageContent()`

**File: `src/lib/integrations/scraping.ts`**

```typescript
/**
 * Fetch job page content from any URL using cascading fallbacks.
 * Returns markdown/text content or null if all methods fail.
 */
export async function fetchJobPageContent(url: string): Promise<string | null> {
  // Try Jina Reader first (free)
  const jinaContent = await tryJinaReader(url);
  if (jinaContent) return jinaContent;

  // Fallback to Bright Data Web Unlocker
  const brightDataContent = await tryBrightDataWebUnlocker(url);
  if (brightDataContent) return brightDataContent;

  return null;
}

async function tryJinaReader(url: string): Promise<string | null> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/markdown' },
    });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

async function tryBrightDataWebUnlocker(url: string): Promise<string | null> {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) return null;

  try {
    // Use Web Unlocker API to fetch raw HTML
    const response = await fetch(
      'https://api.brightdata.com/request?unblock=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, format: 'raw' }),
      }
    );

    if (!response.ok) return null;

    const html = await response.text();
    // Extract text content from HTML using cheerio
    return extractTextFromHtml(html);
  } catch {
    return null;
  }
}

function extractTextFromHtml(html: string): string {
  // Use cheerio to extract main content
  // Remove scripts, styles, nav, footer, etc.
  // Return clean text
}
```

### Updated Opportunity Flow

**In both `process-opportunity/route.ts` and `v1/opportunities/route.ts`:**

```typescript
// LinkedIn URL - use dedicated scraper (existing)
if (url && isLinkedInJobUrl(url)) {
  const linkedInJob = await fetchLinkedInJob(url);
  // ... extract structured data
}
// Other job URL - try generic scraping (new)
else if (url && looksLikeJobUrl(url)) {
  const pageContent = await fetchJobPageContent(url);
  if (pageContent) {
    description = pageContent;
    source = 'scraped';
  } else {
    // Scraping failed - require description
    if (!description) {
      return error("Couldn't fetch that URL. Please paste the job description.");
    }
  }
}
```

### URL Detection

```typescript
function looksLikeJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Known job boards
    const jobBoards = ['indeed.com', 'glassdoor.com', 'ziprecruiter.com',
                       'monster.com', 'dice.com', 'builtin.com', 'lever.co',
                       'greenhouse.io', 'workday.com', 'jobs.', 'careers.'];

    if (jobBoards.some(board => hostname.includes(board))) return true;

    // Common job URL patterns
    if (pathname.includes('/job') || pathname.includes('/career') ||
        pathname.includes('/position') || pathname.includes('/opening')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
```

---

## Data Flow

```
User submits URL
     │
     ├── LinkedIn URL?
     │   └── Bright Data LinkedIn Scraper
     │       └── Structured data (title, company, salary, etc.)
     │
     └── Other URL?
         └── fetchJobPageContent()
             ├── Jina Reader (free)
             │   └── Success → markdown content
             │
             └── Bright Data Web Unlocker (fallback)
                 └── Success → extracted text

         └── Both fail?
             └── Error: "Please paste the job description"
```

---

## Error Handling

| Scenario | Response |
|----------|----------|
| LinkedIn scraping fails | Fall back to requiring description |
| Jina times out | Try Bright Data |
| Bright Data fails | Return error, require description |
| Invalid URL format | Return validation error |
| No description provided + scraping failed | "Couldn't fetch that URL. Please paste the job description." |

---

## Cost Analysis

| Method | Cost | When Used |
|--------|------|-----------|
| Jina Reader | Free | First attempt for all non-LinkedIn URLs |
| Bright Data Web Unlocker | ~$1.50/1K | Fallback when Jina fails |
| LinkedIn Scraper | ~$1.50/1K | All LinkedIn URLs (unchanged) |

Expected: Most URLs will work with Jina (free). Bright Data fallback catches ~10-20% that Jina can't handle.

---

## Implementation Tasks

1. Create `src/lib/integrations/scraping.ts` with Jina + Bright Data fallback
2. Add `looksLikeJobUrl()` helper to detect job URLs
3. Update `process-opportunity/route.ts` to use generic scraping
4. Update `v1/opportunities/route.ts` to use generic scraping
5. Add `source: 'scraped'` for generically scraped opportunities
6. Update UI to show appropriate error when scraping fails

---

## Future Enhancements (Not in Scope)

- Cache scraped content to avoid re-fetching
- Add more specialized scrapers for high-traffic job boards
- Rate limiting per source
- User-configurable scraping preferences
