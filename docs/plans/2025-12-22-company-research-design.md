# Company Research via Tavily

**Status:** Not Started

## Progress (Last reviewed: 2025-12-26)

| Component | Status | Notes |
|-----------|--------|-------|
| Tavily integration | ⏳ Not Started | API client for web search |
| Company research service | ⏳ Not Started | GPT synthesis of search results |
| Database columns | ⏳ Not Started | `company_insights` field needed |
| Integration with opportunity flow | ⏳ Not Started | Trigger on opportunity creation |

### Notes
- Requires `TAVILY_API_KEY` environment variable
- Would enhance tailoring with company context
- Future feature, not currently prioritized

## Overview

Automatically research companies when users add job opportunities. Fetches recent news, company info, and synthesizes insights about likely challenges and how the role fits the company's needs.

Runs for **all opportunities** (not just LinkedIn-enriched ones) - any opportunity with a company name gets researched.

## Problem

Users add job opportunities but lack context about:
- What the company is going through (recent news, funding, challenges)
- Why they're hiring for this role now
- What problems this hire is meant to solve

This context is valuable for:
- Tailoring applications
- Interview preparation
- Deciding whether to apply

## Solution

When an opportunity is created:
1. Extract company name from job data
2. Run Tavily searches for company news and info
3. Use GPT to synthesize insights
4. Store insights with the opportunity

---

## Technical Design

### Tavily Integration

**New service: `src/lib/integrations/tavily.ts`**

```typescript
const TAVILY_API_URL = 'https://api.tavily.com/search';

interface TavilySearchParams {
  query: string;
  topic?: 'general' | 'news' | 'finance';
  search_depth?: 'basic' | 'advanced';
  max_results?: number;
  time_range?: 'day' | 'week' | 'month' | 'year';
  include_answer?: boolean;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
}

export async function searchTavily(params: TavilySearchParams): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: params.query,
      topic: params.topic || 'general',
      search_depth: params.search_depth || 'basic',
      max_results: params.max_results || 5,
      time_range: params.time_range,
      include_answer: params.include_answer || false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status}`);
  }

  return response.json();
}
```

### Company Research Service

**New service: `src/lib/ai/research-company.ts`**

```typescript
interface CompanyInsights {
  company_url: string | null;
  is_public: boolean;
  stock_ticker: string | null;
  industry: string | null;
  recent_news: string[];        // 3-5 recent headlines/summaries
  likely_challenges: string[];  // 3-5 inferred challenges
  role_context: string;         // 2-3 sentences on why they're hiring
}

export async function researchCompany(
  companyName: string,
  jobTitle: string,
  jobDescription: string
): Promise<CompanyInsights> {
  // Run searches in parallel
  const [newsResults, infoResults, financeResults] = await Promise.all([
    searchTavily({
      query: `${companyName} company news 2025`,
      topic: 'news',
      time_range: 'month',
      max_results: 5,
    }),
    searchTavily({
      query: `${companyName} company about website headquarters`,
      topic: 'general',
      max_results: 3,
    }),
    searchTavily({
      query: `${companyName} stock price funding valuation`,
      topic: 'finance',
      max_results: 3,
    }),
  ]);

  // Synthesize with GPT
  const insights = await synthesizeInsights(
    companyName,
    jobTitle,
    jobDescription,
    newsResults,
    infoResults,
    financeResults
  );

  return insights;
}

async function synthesizeInsights(
  companyName: string,
  jobTitle: string,
  jobDescription: string,
  newsResults: TavilyResponse,
  infoResults: TavilyResponse,
  financeResults: TavilyResponse
): Promise<CompanyInsights> {
  const prompt = `Analyze this company and job opportunity.

COMPANY: ${companyName}
JOB TITLE: ${jobTitle}

RECENT NEWS:
${newsResults.results.map(r => `- ${r.title}: ${r.content}`).join('\n')}

COMPANY INFO:
${infoResults.results.map(r => `- ${r.title}: ${r.content}`).join('\n')}

FINANCIAL INFO:
${financeResults.results.map(r => `- ${r.title}: ${r.content}`).join('\n')}

JOB DESCRIPTION (excerpt):
${jobDescription.slice(0, 1500)}

Return JSON:
{
  "company_url": "https://...",
  "is_public": true/false,
  "stock_ticker": "TICKER" or null,
  "industry": "Healthcare Tech" or similar,
  "recent_news": [
    "Brief summary of news item 1",
    "Brief summary of news item 2",
    ...
  ],
  "likely_challenges": [
    "Challenge this hire might address",
    ...
  ],
  "role_context": "2-3 sentences explaining why they're likely hiring for this role now, based on news and job description"
}`;

  // Call GPT and parse response
  // ... (standard GPT call + JSON parsing)
}
```

### Database Changes

**Migration: add company research columns**

```sql
ALTER TABLE opportunities
  ADD COLUMN company_url text,
  ADD COLUMN company_is_public boolean,
  ADD COLUMN company_stock_ticker text,
  ADD COLUMN company_industry text,
  ADD COLUMN company_recent_news jsonb,      -- array of strings
  ADD COLUMN company_challenges jsonb,        -- array of strings
  ADD COLUMN company_role_context text,
  ADD COLUMN company_researched_at timestamptz;
```

### Integration Points

**Update both opportunity endpoints:**

1. `POST /api/process-opportunity` (UI endpoint)
2. `POST /api/v1/opportunities` (API endpoint)

After creating the opportunity, if company name exists:

```typescript
// After opportunity is created
if (finalCompany) {
  // Run research in background (don't block response)
  researchCompanyBackground(opportunity.id, finalCompany, finalTitle, description);
}
```

**Background processing option:**

For better UX, research can run after returning the response:

```typescript
async function researchCompanyBackground(
  opportunityId: string,
  companyName: string,
  jobTitle: string,
  jobDescription: string
) {
  try {
    const insights = await researchCompany(companyName, jobTitle, jobDescription);

    await supabase
      .from('opportunities')
      .update({
        company_url: insights.company_url,
        company_is_public: insights.is_public,
        company_stock_ticker: insights.stock_ticker,
        company_industry: insights.industry,
        company_recent_news: insights.recent_news,
        company_challenges: insights.likely_challenges,
        company_role_context: insights.role_context,
        company_researched_at: new Date().toISOString(),
      })
      .eq('id', opportunityId);
  } catch (error) {
    console.error('Company research failed:', error);
    // Don't fail the opportunity creation
  }
}
```

---

## Cost Analysis

**Tavily pricing:** $0.008 per credit (basic search = 1 credit)

| Searches per opportunity | Credits | Cost |
|-------------------------|---------|------|
| News search | 1 | $0.008 |
| Company info search | 1 | $0.008 |
| Finance search | 1 | $0.008 |
| **Total** | 3 | **$0.024** |

**Plus GPT cost:** ~$0.01 for synthesis

**Total per opportunity:** ~$0.03-0.04

| Usage | Monthly Cost |
|-------|--------------|
| 100 opportunities | ~$3-4 |
| 1,000 opportunities | ~$30-40 |

Free tier (1,000 Tavily credits/month) covers ~300 opportunities.

---

## UI Updates

### Opportunity Detail Page

Add a "Company Insights" card:

```
┌─────────────────────────────────────────────────┐
│ Company Insights                    [Curology]  │
├─────────────────────────────────────────────────┤
│ 🏢 Healthcare Tech • Public (CURE)              │
│ 🌐 curology.com                                 │
│                                                 │
│ Recent News                                     │
│ • Raised $50M Series C to expand AI skincare    │
│ • Launched new mobile app with 2M downloads     │
│ • Named top telehealth startup by Forbes        │
│                                                 │
│ Why This Role                                   │
│ Curology is scaling their mobile-first patient  │
│ experience and integrating AI into their care   │
│ model. This VP Product hire will likely lead    │
│ the mobile app roadmap and AI feature strategy. │
│                                                 │
│ Likely Challenges                               │
│ • Scaling mobile app to millions of users       │
│ • Integrating LLMs into clinical workflows      │
│ • Balancing AI automation with human care       │
└─────────────────────────────────────────────────┘
```

### Loading State

While research is running (if not backgrounded):
- Show "Researching company..." spinner
- Or show opportunity immediately, update when research completes

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| No company name | Skip research entirely |
| Tavily API error | Log, continue without insights |
| GPT synthesis fails | Store raw search results, skip synthesis |
| Company not found | Store empty insights, mark as researched |
| Tavily rate limit | Queue for retry, or skip |

**Principle:** Company research is additive. Never fail opportunity creation due to research failure.

---

## Environment Variables

```bash
TAVILY_API_KEY=tvly-xxxxxxxxxxxxx
```

---

## Implementation Tasks

### Phase 1: Core Integration
1. Create `src/lib/integrations/tavily.ts`
2. Create `src/lib/ai/research-company.ts`
3. Add database migration for company research columns
4. Add `TAVILY_API_KEY` to environment

### Phase 2: API Integration
5. Update `POST /api/process-opportunity` to trigger research
6. Update `POST /api/v1/opportunities` to trigger research
7. Decide: synchronous vs background processing

### Phase 3: UI
8. Add "Company Insights" card to opportunity detail page
9. Handle loading/empty states

---

## Future Enhancements (Not in Scope)

- **Competitor analysis** - Search for "{company} competitors"
- **Glassdoor integration** - Company reviews, interview questions
- **LinkedIn company data** - Employee count, growth rate
- **Re-research button** - Manually refresh company insights
- **Research depth options** - Quick vs deep research

---

## Success Metrics

- Company insights populated for X% of opportunities with company names
- Research completes within 10 seconds (or background completes within 30s)
- No increase in opportunity creation failures
