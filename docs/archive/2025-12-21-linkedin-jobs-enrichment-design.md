# LinkedIn Jobs Enrichment via Bright Data

## Overview

Automatically enrich job opportunities when users paste LinkedIn job URLs. Instead of relying on manually pasted job descriptions, fetch structured data directly from LinkedIn via Bright Data's Web Scraper API.

## Problem

Currently, when users add opportunities:
1. They paste a job URL and/or description manually
2. Description quality varies - sometimes incomplete, poorly formatted, or missing key details
3. No structured metadata (salary, seniority level, applicant count)
4. Requirements extraction depends on the quality of pasted text

## Solution

When a user adds an opportunity with a LinkedIn job URL (`linkedin.com/jobs/view/*`):
1. Detect the LinkedIn URL pattern
2. Call Bright Data's sync API to fetch structured job data
3. Use enriched data to populate the opportunity
4. Continue existing flow (extract requirements, embed, store)

## Value

| Before | After |
|--------|-------|
| Unstructured pasted text | Full job description with formatting |
| No salary info | Structured salary range (min/max/currency) |
| Unknown seniority | Executive/Senior/Mid/Entry level |
| No context | Applicant count, posted date, easy apply flag |
| Variable quality | Consistent, complete data |

---

## Technical Design

### Bright Data Integration

**API Endpoint:** `POST https://api.brightdata.com/datasets/v3/scrape`

**Dataset ID:** `gd_lpfll7v5hcqtkxl6l` (LinkedIn Jobs)

**Request:**
```bash
curl -H "Authorization: Bearer {API_KEY}" \
     -H "Content-Type: application/json" \
     -d '[{"url":"https://www.linkedin.com/jobs/view/123456/"}]' \
     "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lpfll7v5hcqtkxl6l&format=json"
```

**Response fields we use:**

| Field | Type | Maps To |
|-------|------|---------|
| `job_title` | string | `opportunities.title` |
| `company_name` | string | `opportunities.company` |
| `job_location` | string | New field or metadata |
| `job_summary` | string | `opportunities.description` (plain text) |
| `job_description_formatted` | string | Store as `description_html` for display |
| `job_seniority_level` | string | New metadata field |
| `job_employment_type` | string | New metadata field |
| `job_function` | string | New metadata field |
| `job_industries` | string | New metadata field |
| `base_salary.min_amount` | number | New metadata field |
| `base_salary.max_amount` | number | New metadata field |
| `base_salary.currency` | string | New metadata field |
| `job_num_applicants` | number | New metadata field |
| `job_posted_date` | string | New metadata field |
| `is_easy_apply` | boolean | New metadata field |
| `company_logo` | string | New metadata field |

### New Service: `src/lib/integrations/brightdata.ts`

```typescript
import { z } from 'zod';

const BRIGHTDATA_API_URL = 'https://api.brightdata.com/datasets/v3/scrape';
const LINKEDIN_JOBS_DATASET_ID = 'gd_lpfll7v5hcqtkxl6l';

// Response schema from Bright Data
const LinkedInJobSchema = z.object({
  job_posting_id: z.string(),
  job_title: z.string(),
  company_name: z.string(),
  company_id: z.string().optional(),
  company_logo: z.string().optional(),
  company_url: z.string().optional(),
  job_location: z.string().optional(),
  job_summary: z.string(),
  job_description_formatted: z.string().optional(),
  job_seniority_level: z.string().optional(),
  job_employment_type: z.string().optional(),
  job_function: z.string().optional(),
  job_industries: z.string().optional(),
  job_base_pay_range: z.string().optional(),
  base_salary: z.object({
    min_amount: z.number(),
    max_amount: z.number(),
    currency: z.string(),
    payment_period: z.string(),
  }).optional(),
  job_num_applicants: z.number().optional(),
  job_posted_date: z.string().optional(),
  job_posted_time: z.string().optional(),
  is_easy_apply: z.boolean().optional(),
  apply_link: z.string().optional(),
});

export type LinkedInJob = z.infer<typeof LinkedInJobSchema>;

export async function fetchLinkedInJob(jobUrl: string): Promise<LinkedInJob> {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    throw new Error('BRIGHTDATA_API_KEY not configured');
  }

  const response = await fetch(
    `${BRIGHTDATA_API_URL}?dataset_id=${LINKEDIN_JOBS_DATASET_ID}&format=json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ url: normalizeLinkedInJobUrl(jobUrl) }]),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bright Data API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No job data returned from Bright Data');
  }

  return LinkedInJobSchema.parse(data[0]);
}

// Clean up LinkedIn job URLs (remove tracking params)
function normalizeLinkedInJobUrl(url: string): string {
  const parsed = new URL(url);
  // Keep only the base job view URL
  const jobId = parsed.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
  if (!jobId) {
    throw new Error('Invalid LinkedIn job URL');
  }
  return `https://www.linkedin.com/jobs/view/${jobId}/`;
}

// URL detection helper
export function isLinkedInJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('linkedin.com') &&
           parsed.pathname.includes('/jobs/view/');
  } catch {
    return false;
  }
}
```

### Database Changes

Add metadata fields to `opportunities` table:

```sql
-- Migration: add_linkedin_job_metadata
ALTER TABLE opportunities
  ADD COLUMN location text,
  ADD COLUMN seniority_level text,
  ADD COLUMN employment_type text,
  ADD COLUMN job_function text,
  ADD COLUMN industries text,
  ADD COLUMN salary_min integer,
  ADD COLUMN salary_max integer,
  ADD COLUMN salary_currency text,
  ADD COLUMN applicant_count integer,
  ADD COLUMN posted_date timestamptz,
  ADD COLUMN easy_apply boolean,
  ADD COLUMN company_logo_url text,
  ADD COLUMN description_html text,
  ADD COLUMN source text DEFAULT 'manual'; -- 'manual' | 'linkedin'
```

### Modified API Endpoint: `POST /api/v1/opportunities`

Update the existing endpoint to detect LinkedIn URLs and enrich:

```typescript
// src/app/api/v1/opportunities/route.ts

import { fetchLinkedInJob, isLinkedInJobUrl } from '@/lib/integrations/brightdata';

export async function POST(request: Request) {
  const body = await request.json();
  const { url, title, company, description } = body;

  let opportunityData = { url, title, company, description };
  let source = 'manual';

  // Enrich from LinkedIn if URL detected
  if (url && isLinkedInJobUrl(url)) {
    try {
      const linkedInJob = await fetchLinkedInJob(url);

      opportunityData = {
        url,
        title: linkedInJob.job_title,
        company: linkedInJob.company_name,
        description: linkedInJob.job_summary,
        // Additional fields
        description_html: linkedInJob.job_description_formatted,
        location: linkedInJob.job_location,
        seniority_level: linkedInJob.job_seniority_level,
        employment_type: linkedInJob.job_employment_type,
        job_function: linkedInJob.job_function,
        industries: linkedInJob.job_industries,
        salary_min: linkedInJob.base_salary?.min_amount,
        salary_max: linkedInJob.base_salary?.max_amount,
        salary_currency: linkedInJob.base_salary?.currency,
        applicant_count: linkedInJob.job_num_applicants,
        posted_date: linkedInJob.job_posted_date,
        easy_apply: linkedInJob.is_easy_apply,
        company_logo_url: linkedInJob.company_logo,
      };
      source = 'linkedin';
    } catch (error) {
      // Log error but don't fail - fall back to manual data
      console.error('LinkedIn enrichment failed:', error);
      // Continue with user-provided data
    }
  }

  // Continue with existing flow: extract requirements, embed, store
  // ...
}
```

### Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid LinkedIn URL format | Reject with 400, clear error message |
| Bright Data API timeout (>60s) | Fall back to manual data, log warning |
| Bright Data rate limit | Fall back to manual data, log warning |
| Job not found / removed | Fall back to manual data, inform user |
| Bright Data outage | Fall back to manual data, log error |
| Missing API key | Fail fast on startup, not runtime |

**Principle:** LinkedIn enrichment is additive. If it fails, we gracefully fall back to whatever the user provided. Never block opportunity creation due to enrichment failure.

---

## Environment Variables

```bash
# .env.local
BRIGHTDATA_API_KEY=your-api-key-here
```

Add to Vercel environment variables for production.

---

## Implementation Tasks

### Phase 1: Core Integration
1. Create `src/lib/integrations/brightdata.ts` with `fetchLinkedInJob()`
2. Add database migration for new opportunity metadata fields
3. Update `POST /api/v1/opportunities` to detect and enrich LinkedIn URLs
4. Add `BRIGHTDATA_API_KEY` to environment

### Phase 2: Frontend Updates
5. Update `AddOpportunityDialog` to show enriched data after URL paste
6. Update opportunity detail page to display new metadata (salary, seniority, etc.)
7. Add loading state during enrichment

### Phase 3: Polish
8. Add company logo display
9. Format salary range nicely in UI
10. Show "Enriched from LinkedIn" badge on enriched opportunities

---

## Cost Analysis

**Bright Data pricing:** $1.50 per 1,000 records

| Usage | Cost |
|-------|------|
| 100 jobs/month | $0.15 |
| 1,000 jobs/month | $1.50 |
| 10,000 jobs/month | $15.00 |

Cost is negligible. No need for caching or rate limiting for cost reasons.

---

## Future Considerations (Not in Scope)

- **Profile import via LinkedIn** - Tested, but data availability varies by profile visibility. Defer until Apify testing complete.
- **Bulk job import** - Could support pasting multiple LinkedIn job URLs at once
- **Job URL auto-detection** - Could scan pasted text for LinkedIn URLs and offer to enrich
- **Indeed/Glassdoor integration** - Same pattern could apply to other job boards

---

## Testing Plan

1. **Unit tests** for URL detection and normalization
2. **Integration test** with real Bright Data API (use test job URL)
3. **Fallback test** - verify graceful degradation when API fails
4. **E2E test** - add opportunity via UI with LinkedIn URL, verify enrichment

---

## Success Metrics

- Enriched opportunities have complete title, company, description
- Salary data available on X% of LinkedIn job opportunities
- No increase in opportunity creation failures
- User feedback on data quality improvement
