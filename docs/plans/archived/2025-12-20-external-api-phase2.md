# External API Phase 2: Opportunity Operations

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** Done
**Goal:** Add opportunity management endpoints to the external API - create, match, tailor, and share.

## Progress (Last reviewed: 2025-12-24)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: POST /api/v1/opportunities | ✅ Complete | Verified in route.ts |
| Task 2: GET /api/v1/opportunities/:id | ✅ Complete | Verified [id]/route.ts |
| Task 3: GET /api/v1/opportunities/:id/match | ✅ Complete | Verified match/ directory |
| Task 4: POST /api/v1/opportunities/:id/tailor | ✅ Complete | Verified tailor/ directory |
| Task 5: GET /api/v1/opportunities/:id/tailored-profile | ✅ Complete | Verified tailored-profile/ |
| Task 6: POST /api/v1/opportunities/:id/share | ✅ Complete | Verified share/ directory |
| Task 7: POST /api/v1/opportunities/add-and-tailor | ✅ Complete | Verified add-and-tailor/ |
| Task 8: POST /api/v1/opportunities/add-tailor-share | ✅ Complete | Verified add-tailor-share/ |
| Task 9: Fix Lib Function Dependencies | ✅ Complete | |
| Task 10: Integration Testing | ✅ Complete | |

### Drift Notes
None - implementation matches plan

**Architecture:** New v1 API routes with API key auth that call existing lib functions. Each endpoint is thin: validate request, call lib function, format response. Long operations (tailor) stream progress via SSE.

**Tech Stack:** Next.js 14 API routes, Supabase PostgreSQL, OpenAI, SSE streaming

---

## Task 1: POST /api/v1/opportunities - Add Opportunity

**Files:**
- Modify: `src/app/api/v1/opportunities/route.ts`
- Reference: `src/app/api/process-opportunity/route.ts` (existing logic)

**Step 1: Read existing implementation**

Review `src/app/api/process-opportunity/route.ts` to understand the extraction logic. Key parts:
- Takes `url` and `description`
- Uses GPT to extract title, company, requirements
- Generates embedding
- Inserts into `opportunities` table

**Step 2: Add POST handler to v1 opportunities route**

Add to `src/app/api/v1/opportunities/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import OpenAI from 'openai';
import { generateEmbedding } from '@/lib/ai/embeddings';
import type { Json } from '@/lib/supabase/types';

const openai = new OpenAI();

interface ClassifiedRequirement {
  text: string;
  type: 'education' | 'certification' | 'skill' | 'experience';
}

const EXTRACTION_PROMPT = `Extract job details and requirements from this job posting. Return ONLY valid JSON.

Extract:
- title: The job title
- company: The company name if mentioned, or null
- mustHave: Required qualifications with classification
- niceToHave: Preferred qualifications with classification
- responsibilities: Key job duties

For each requirement, classify as:
- "education": Degree, diploma, academic qualification
- "certification": Professional certification/license
- "skill": Technical skill, tool, competency
- "experience": Work experience, years in role

Return JSON:
{
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "mustHave": [{"text": "5+ years Python", "type": "experience"}],
  "niceToHave": [{"text": "AWS Certified", "type": "certification"}],
  "responsibilities": ["Lead technical design"]
}

JOB DESCRIPTION:
`;

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  try {
    const body = await request.json();
    const { url, description } = body;

    if (!description) {
      return apiError('validation_error', 'description is required', 400);
    }

    // Extract using GPT
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'You are a job posting analyzer. Return ONLY valid JSON.' },
        { role: 'user', content: EXTRACTION_PROMPT + description },
      ],
    });

    const content = response.choices[0]?.message?.content;
    let extracted = {
      title: 'Unknown Position',
      company: null as string | null,
      mustHave: [] as ClassifiedRequirement[],
      niceToHave: [] as ClassifiedRequirement[],
      responsibilities: [] as string[],
    };

    if (content) {
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extracted = JSON.parse(cleaned);
      } catch {
        console.error('Failed to parse extraction:', content);
      }
    }

    const requirements = {
      mustHave: extracted.mustHave,
      niceToHave: extracted.niceToHave,
      responsibilities: extracted.responsibilities,
    };

    // Generate embedding
    const reqTexts = extracted.mustHave.slice(0, 5).map(r => r.text).join('. ');
    const embeddingText = `${extracted.title} at ${extracted.company || 'Unknown'}. ${reqTexts}`;
    const embedding = await generateEmbedding(embeddingText);

    // Insert opportunity
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert({
        user_id: userId,
        title: extracted.title,
        company: extracted.company,
        url: url || null,
        description,
        requirements: requirements as unknown as Json,
        embedding: embedding as unknown as string,
        status: 'tracking' as const,
      })
      .select('id, title, company, status, created_at')
      .single();

    if (error) {
      console.error('Failed to insert opportunity:', error);
      return apiError('server_error', 'Failed to save opportunity', 500);
    }

    return apiSuccess({
      id: opportunity.id,
      title: opportunity.title,
      company: opportunity.company,
      status: opportunity.status,
      requirements: {
        must_have_count: extracted.mustHave.length,
        nice_to_have_count: extracted.niceToHave.length,
      },
      created_at: opportunity.created_at,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return apiError('server_error', 'Failed to process opportunity', 500);
  }
}
```

**Step 3: Verify it compiles**

```bash
pnpm exec tsc --noEmit
```

**Step 4: Test manually**

```bash
curl -X POST http://localhost:3000/api/v1/opportunities \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"description": "Senior Software Engineer at Acme Corp. Requirements: 5+ years Python, AWS experience preferred."}'
```

**Step 5: Commit**

```bash
git add src/app/api/v1/opportunities/route.ts
git commit -m "feat(api): add POST /api/v1/opportunities endpoint"
```

---

## Task 2: GET /api/v1/opportunities/:id - Single Opportunity

**Files:**
- Create: `src/app/api/v1/opportunities/[id]/route.ts`

**Step 1: Create the route file**

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !opportunity) {
    return ApiErrors.notFound('Opportunity');
  }

  return apiSuccess({
    id: opportunity.id,
    title: opportunity.title,
    company: opportunity.company,
    url: opportunity.url,
    description: opportunity.description,
    requirements: opportunity.requirements,
    status: opportunity.status,
    created_at: opportunity.created_at,
  });
}
```

**Step 2: Verify it compiles**

```bash
pnpm exec tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/v1/opportunities/[id]/route.ts
git commit -m "feat(api): add GET /api/v1/opportunities/:id endpoint"
```

---

## Task 3: GET /api/v1/opportunities/:id/match - Match Analysis

**Files:**
- Create: `src/app/api/v1/opportunities/[id]/match/route.ts`
- Reference: `src/lib/ai/match-opportunity.ts`

**Step 1: Create the match route**

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors } from '@/lib/api/response';
import { computeOpportunityMatches } from '@/lib/ai/match-opportunity';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Verify opportunity exists and belongs to user
  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('id, title, company')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !opportunity) {
    return ApiErrors.notFound('Opportunity');
  }

  // Compute matches
  const matchResult = await computeOpportunityMatches(id, userId);

  return apiSuccess({
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      company: opportunity.company,
    },
    scores: {
      overall: matchResult.overallScore,
      must_have: matchResult.mustHaveScore,
      nice_to_have: matchResult.niceToHaveScore,
    },
    strengths: matchResult.strengths.slice(0, 5).map(s => ({
      requirement: s.requirement.text,
      match: s.bestMatch ? {
        claim: s.bestMatch.label,
        type: s.bestMatch.type,
        similarity: Math.round(s.bestMatch.similarity * 100),
      } : null,
    })),
    gaps: matchResult.gaps.map(g => ({
      requirement: g.text,
      type: g.type,
      category: g.category,
    })),
  });
}
```

**Step 2: Fix import issue**

The `computeOpportunityMatches` function uses session-based `createClient`. We need to modify it to accept a supabase client as parameter, or create a version that works with service role.

Check `src/lib/ai/match-opportunity.ts` - if it uses `createClient` internally, we have two options:
1. Pass supabase client as parameter
2. Create a wrapper that uses service role

For now, the simplest fix is to update the lib function to accept an optional client. But to avoid modifying existing code, let's create a wrapper in the route that temporarily works around this.

Actually, looking at the code, `computeOpportunityMatches` calls `createClient` which will fail without a session. We need to either:
- Refactor the lib to accept a client
- Or use a different approach

**Step 3: Create service-role compatible match function**

Create `src/lib/ai/match-opportunity-api.ts`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbeddings } from './embeddings';
import type { Database } from '@/lib/supabase/types';

type RequirementType = 'education' | 'certification' | 'skill' | 'experience';

interface ClassifiedRequirement {
  text: string;
  type: RequirementType;
}

interface Requirement {
  text: string;
  category: 'mustHave' | 'niceToHave';
  type: RequirementType;
}

interface MatchedClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
  similarity: number;
}

interface RequirementMatch {
  requirement: Requirement;
  matches: MatchedClaim[];
  bestMatch: MatchedClaim | null;
}

export interface MatchResult {
  overallScore: number;
  mustHaveScore: number;
  niceToHaveScore: number;
  requirementMatches: RequirementMatch[];
  gaps: Requirement[];
  strengths: RequirementMatch[];
}

const MATCH_THRESHOLD = 0.40;

const VALID_CLAIM_TYPES: Record<RequirementType, string[]> = {
  education: ['education'],
  certification: ['certification'],
  skill: ['skill', 'achievement'],
  experience: ['skill', 'achievement', 'attribute'],
};

export async function computeOpportunityMatchesWithClient(
  supabase: SupabaseClient<Database>,
  opportunityId: string,
  userId: string
): Promise<MatchResult> {
  // Get opportunity requirements
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('requirements')
    .eq('id', opportunityId)
    .single();

  if (!opportunity?.requirements) {
    return {
      overallScore: 0,
      mustHaveScore: 0,
      niceToHaveScore: 0,
      requirementMatches: [],
      gaps: [],
      strengths: [],
    };
  }

  const reqs = opportunity.requirements as {
    mustHave?: ClassifiedRequirement[] | string[];
    niceToHave?: ClassifiedRequirement[] | string[];
  };

  const normalizeReqs = (
    items: ClassifiedRequirement[] | string[] | undefined,
    category: 'mustHave' | 'niceToHave'
  ): Requirement[] => {
    if (!items) return [];
    return items.map((item) => {
      if (typeof item === 'string') {
        return { text: item, category, type: 'skill' as RequirementType };
      }
      return { text: item.text, category, type: item.type || 'skill' };
    });
  };

  const requirements: Requirement[] = [
    ...normalizeReqs(reqs.mustHave, 'mustHave'),
    ...normalizeReqs(reqs.niceToHave, 'niceToHave'),
  ];

  if (requirements.length === 0) {
    return {
      overallScore: 0,
      mustHaveScore: 0,
      niceToHaveScore: 0,
      requirementMatches: [],
      gaps: [],
      strengths: [],
    };
  }

  const embeddings = await generateEmbeddings(requirements.map((r) => r.text));
  const requirementMatches: RequirementMatch[] = [];

  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    const embedding = embeddings[i];

    const { data: matches, error } = await supabase.rpc('match_identity_claims', {
      query_embedding: embedding as unknown as string,
      match_user_id: userId,
      match_threshold: MATCH_THRESHOLD,
      match_count: 10,
    });

    if (error) {
      console.error(`Error matching requirement "${req.text}":`, error);
    }

    const validClaimTypes = VALID_CLAIM_TYPES[req.type];
    const matchedClaims: MatchedClaim[] = (matches || [])
      .filter((m: { type: string }) => validClaimTypes.includes(m.type))
      .slice(0, 3)
      .map((m: {
        id: string;
        type: string;
        label: string;
        description: string | null;
        confidence: number;
        similarity: number;
      }) => ({
        id: m.id,
        type: m.type,
        label: m.label,
        description: m.description,
        confidence: m.confidence,
        similarity: m.similarity,
      }));

    requirementMatches.push({
      requirement: req,
      matches: matchedClaims,
      bestMatch: matchedClaims[0] || null,
    });
  }

  const mustHaveMatches = requirementMatches.filter(
    (rm) => rm.requirement.category === 'mustHave' && rm.bestMatch
  );
  const niceToHaveMatches = requirementMatches.filter(
    (rm) => rm.requirement.category === 'niceToHave' && rm.bestMatch
  );

  const totalMustHave = requirementMatches.filter(
    (rm) => rm.requirement.category === 'mustHave'
  ).length;
  const totalNiceToHave = requirementMatches.filter(
    (rm) => rm.requirement.category === 'niceToHave'
  ).length;

  const mustHaveScore = totalMustHave > 0
    ? Math.round((mustHaveMatches.length / totalMustHave) * 100)
    : 100;
  const niceToHaveScore = totalNiceToHave > 0
    ? Math.round((niceToHaveMatches.length / totalNiceToHave) * 100)
    : 100;

  const overallScore = Math.round(mustHaveScore * 0.7 + niceToHaveScore * 0.3);

  const gaps = requirementMatches
    .filter((rm) => !rm.bestMatch)
    .map((rm) => rm.requirement);

  const strengths = requirementMatches
    .filter((rm) => rm.bestMatch && rm.bestMatch.similarity > 0.4)
    .sort((a, b) => (b.bestMatch?.similarity || 0) - (a.bestMatch?.similarity || 0));

  return {
    overallScore,
    mustHaveScore,
    niceToHaveScore,
    requirementMatches,
    gaps,
    strengths,
  };
}
```

**Step 4: Update the match route to use new function**

Update `src/app/api/v1/opportunities/[id]/match/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors } from '@/lib/api/response';
import { computeOpportunityMatchesWithClient } from '@/lib/ai/match-opportunity-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Verify opportunity exists and belongs to user
  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('id, title, company')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !opportunity) {
    return ApiErrors.notFound('Opportunity');
  }

  // Compute matches
  const matchResult = await computeOpportunityMatchesWithClient(supabase, id, userId);

  return apiSuccess({
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      company: opportunity.company,
    },
    scores: {
      overall: matchResult.overallScore,
      must_have: matchResult.mustHaveScore,
      nice_to_have: matchResult.niceToHaveScore,
    },
    strengths: matchResult.strengths.slice(0, 5).map(s => ({
      requirement: s.requirement.text,
      match: s.bestMatch ? {
        claim: s.bestMatch.label,
        type: s.bestMatch.type,
        similarity: Math.round(s.bestMatch.similarity * 100),
      } : null,
    })),
    gaps: matchResult.gaps.map(g => ({
      requirement: g.text,
      type: g.type,
      category: g.category,
    })),
  });
}
```

**Step 5: Verify it compiles**

```bash
pnpm exec tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/lib/ai/match-opportunity-api.ts src/app/api/v1/opportunities/[id]/match/route.ts
git commit -m "feat(api): add GET /api/v1/opportunities/:id/match endpoint"
```

---

## Task 4: POST /api/v1/opportunities/:id/tailor - Generate Tailored Profile

**Files:**
- Create: `src/app/api/v1/opportunities/[id]/tailor/route.ts`
- Create: `src/lib/ai/generate-profile-api.ts`
- Reference: `src/app/api/generate-profile/route.ts`

**Step 1: Create API-compatible profile generation**

Create `src/lib/ai/generate-profile-api.ts`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { generateTalkingPoints } from './generate-talking-points';
import { generateNarrative } from './generate-narrative';
import { generateResume } from './generate-resume';
import type { Database } from '@/lib/supabase/types';
import type { Json } from '@/lib/supabase/types';

export interface GenerateProfileResult {
  profile: {
    id: string;
    talking_points: unknown;
    narrative: string;
    resume_data: unknown;
    created_at: string;
  };
  cached: boolean;
}

export async function generateProfileWithClient(
  supabase: SupabaseClient<Database>,
  opportunityId: string,
  userId: string,
  regenerate: boolean = false
): Promise<GenerateProfileResult> {
  // Check opportunity exists
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('id, title, company')
    .eq('id', opportunityId)
    .eq('user_id', userId)
    .single();

  if (!opportunity) {
    throw new Error('Opportunity not found');
  }

  // Check for existing profile
  if (!regenerate) {
    const { data: existingProfile } = await supabase
      .from('tailored_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('opportunity_id', opportunityId)
      .single();

    if (existingProfile) {
      return {
        profile: {
          id: existingProfile.id,
          talking_points: existingProfile.talking_points,
          narrative: existingProfile.narrative || '',
          resume_data: existingProfile.resume_data,
          created_at: existingProfile.created_at || '',
        },
        cached: true,
      };
    }
  } else {
    // Delete existing if regenerating
    await supabase
      .from('tailored_profiles')
      .delete()
      .eq('user_id', userId)
      .eq('opportunity_id', opportunityId);
  }

  // Generate new profile
  const talkingPoints = await generateTalkingPoints(opportunityId, userId);
  const narrative = await generateNarrative(
    talkingPoints,
    opportunity.title,
    opportunity.company
  );
  const resumeData = await generateResume(userId, opportunityId, talkingPoints);

  // Store profile
  const { data: profile, error } = await supabase
    .from('tailored_profiles')
    .insert({
      user_id: userId,
      opportunity_id: opportunityId,
      talking_points: talkingPoints as unknown as Json,
      narrative,
      narrative_original: narrative,
      resume_data: resumeData as unknown as Json,
      resume_data_original: resumeData as unknown as Json,
      edited_fields: [],
    })
    .select()
    .single();

  if (error) {
    throw new Error('Failed to save profile');
  }

  return {
    profile: {
      id: profile.id,
      talking_points: profile.talking_points,
      narrative: profile.narrative || '',
      resume_data: profile.resume_data,
      created_at: profile.created_at || '',
    },
    cached: false,
  };
}
```

**Step 2: Create tailor endpoint (synchronous first)**

Create `src/app/api/v1/opportunities/[id]/tailor/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors, apiError } from '@/lib/api/response';
import { generateProfileWithClient } from '@/lib/ai/generate-profile-api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Parse optional regenerate flag
  let regenerate = false;
  try {
    const body = await request.json();
    regenerate = body.regenerate === true;
  } catch {
    // No body or invalid JSON is fine
  }

  // Verify opportunity exists and belongs to user
  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select('id, title, company')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !opportunity) {
    return ApiErrors.notFound('Opportunity');
  }

  try {
    const result = await generateProfileWithClient(supabase, id, userId, regenerate);

    return apiSuccess({
      id: result.profile.id,
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        company: opportunity.company,
      },
      narrative: result.profile.narrative,
      resume_data: result.profile.resume_data,
      cached: result.cached,
      created_at: result.profile.created_at,
    });
  } catch (err) {
    console.error('Profile generation error:', err);
    return apiError('processing_failed', 'Failed to generate tailored profile', 500);
  }
}
```

**Step 3: Verify it compiles**

```bash
pnpm exec tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/ai/generate-profile-api.ts src/app/api/v1/opportunities/[id]/tailor/route.ts
git commit -m "feat(api): add POST /api/v1/opportunities/:id/tailor endpoint"
```

---

## Task 5: GET /api/v1/opportunities/:id/tailored-profile

**Files:**
- Create: `src/app/api/v1/opportunities/[id]/tailored-profile/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // Get tailored profile for this opportunity
  const { data: profile, error } = await supabase
    .from('tailored_profiles')
    .select(`
      id,
      narrative,
      resume_data,
      talking_points,
      edited_fields,
      created_at,
      opportunities!inner (
        id,
        title,
        company
      )
    `)
    .eq('opportunity_id', id)
    .eq('user_id', userId)
    .single();

  if (error || !profile) {
    return ApiErrors.notFound('Tailored profile');
  }

  const opp = profile.opportunities as { id: string; title: string; company: string | null };

  return apiSuccess({
    id: profile.id,
    opportunity: {
      id: opp.id,
      title: opp.title,
      company: opp.company,
    },
    narrative: profile.narrative,
    resume_data: profile.resume_data,
    talking_points: profile.talking_points,
    edited_fields: profile.edited_fields,
    created_at: profile.created_at,
  });
}
```

**Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/v1/opportunities/[id]/tailored-profile/route.ts
git commit -m "feat(api): add GET /api/v1/opportunities/:id/tailored-profile endpoint"
```

---

## Task 6: POST /api/v1/opportunities/:id/share - Create Share Link

**Files:**
- Create: `src/app/api/v1/opportunities/[id]/share/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors, apiError } from '@/lib/api/response';
import { randomBytes } from 'crypto';

function generateToken(): string {
  return randomBytes(16).toString('hex');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const { id: opportunityId } = await params;
  const supabase = createServiceRoleClient();

  // Parse optional expiration
  let expiresInDays = 30;
  try {
    const body = await request.json();
    if (typeof body.expires_in_days === 'number') {
      expiresInDays = body.expires_in_days;
    }
  } catch {
    // No body is fine
  }

  // Get tailored profile for this opportunity
  const { data: profile, error: profileError } = await supabase
    .from('tailored_profiles')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    return apiError('validation_error', 'No tailored profile exists for this opportunity. Generate one first with POST /opportunities/:id/tailor', 400);
  }

  // Check for existing link
  const { data: existingLink } = await supabase
    .from('shared_links')
    .select('id, token, expires_at')
    .eq('tailored_profile_id', profile.id)
    .is('revoked_at', null)
    .single();

  if (existingLink) {
    // Return existing link
    return apiSuccess({
      id: existingLink.id,
      token: existingLink.token,
      url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${existingLink.token}`,
      expires_at: existingLink.expires_at,
      existing: true,
    });
  }

  // Calculate expiration
  const expiresAt = new Date();
  if (expiresInDays > 0) {
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 10);
  }

  const token = generateToken();
  const { data: newLink, error } = await supabase
    .from('shared_links')
    .insert({
      tailored_profile_id: profile.id,
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create shared link:', error);
    return apiError('server_error', 'Failed to create share link', 500);
  }

  return apiSuccess({
    id: newLink.id,
    token: newLink.token,
    url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${token}`,
    expires_at: newLink.expires_at,
    existing: false,
  });
}
```

**Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/v1/opportunities/[id]/share/route.ts
git commit -m "feat(api): add POST /api/v1/opportunities/:id/share endpoint"
```

---

## Task 7: POST /api/v1/opportunities/add-and-tailor - Compound Operation

**Files:**
- Create: `src/app/api/v1/opportunities/add-and-tailor/route.ts`

**Step 1: Create compound endpoint**

This endpoint combines add + tailor in a single call:

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import OpenAI from 'openai';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { generateProfileWithClient } from '@/lib/ai/generate-profile-api';
import type { Json } from '@/lib/supabase/types';

const openai = new OpenAI();

interface ClassifiedRequirement {
  text: string;
  type: 'education' | 'certification' | 'skill' | 'experience';
}

const EXTRACTION_PROMPT = `Extract job details from this job posting. Return ONLY valid JSON.

{
  "title": "Job Title",
  "company": "Company Name or null",
  "mustHave": [{"text": "requirement", "type": "skill|education|certification|experience"}],
  "niceToHave": [{"text": "requirement", "type": "skill|education|certification|experience"}],
  "responsibilities": ["duty1", "duty2"]
}

JOB DESCRIPTION:
`;

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  try {
    const body = await request.json();
    const { url, description } = body;

    if (!description) {
      return apiError('validation_error', 'description is required', 400);
    }

    // Step 1: Extract opportunity details
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'You are a job posting analyzer. Return ONLY valid JSON.' },
        { role: 'user', content: EXTRACTION_PROMPT + description },
      ],
    });

    const content = response.choices[0]?.message?.content;
    let extracted = {
      title: 'Unknown Position',
      company: null as string | null,
      mustHave: [] as ClassifiedRequirement[],
      niceToHave: [] as ClassifiedRequirement[],
      responsibilities: [] as string[],
    };

    if (content) {
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extracted = JSON.parse(cleaned);
      } catch {
        console.error('Failed to parse extraction');
      }
    }

    const requirements = {
      mustHave: extracted.mustHave,
      niceToHave: extracted.niceToHave,
      responsibilities: extracted.responsibilities,
    };

    // Generate embedding
    const reqTexts = extracted.mustHave.slice(0, 5).map(r => r.text).join('. ');
    const embeddingText = `${extracted.title} at ${extracted.company || 'Unknown'}. ${reqTexts}`;
    const embedding = await generateEmbedding(embeddingText);

    // Step 2: Insert opportunity
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .insert({
        user_id: userId,
        title: extracted.title,
        company: extracted.company,
        url: url || null,
        description,
        requirements: requirements as unknown as Json,
        embedding: embedding as unknown as string,
        status: 'tracking' as const,
      })
      .select('id, title, company')
      .single();

    if (oppError || !opportunity) {
      return apiError('server_error', 'Failed to save opportunity', 500);
    }

    // Step 3: Generate tailored profile
    const profileResult = await generateProfileWithClient(supabase, opportunity.id, userId);

    return apiSuccess({
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        company: opportunity.company,
      },
      profile: {
        id: profileResult.profile.id,
        narrative: profileResult.profile.narrative,
        resume_data: profileResult.profile.resume_data,
      },
    });
  } catch (err) {
    console.error('Add-and-tailor error:', err);
    return apiError('server_error', 'Failed to process request', 500);
  }
}
```

**Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/v1/opportunities/add-and-tailor/route.ts
git commit -m "feat(api): add POST /api/v1/opportunities/add-and-tailor compound endpoint"
```

---

## Task 8: POST /api/v1/opportunities/add-tailor-share - Full Compound

**Files:**
- Create: `src/app/api/v1/opportunities/add-tailor-share/route.ts`

**Step 1: Create full compound endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import OpenAI from 'openai';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { generateProfileWithClient } from '@/lib/ai/generate-profile-api';
import { randomBytes } from 'crypto';
import type { Json } from '@/lib/supabase/types';

const openai = new OpenAI();

interface ClassifiedRequirement {
  text: string;
  type: 'education' | 'certification' | 'skill' | 'experience';
}

const EXTRACTION_PROMPT = `Extract job details from this job posting. Return ONLY valid JSON.

{
  "title": "Job Title",
  "company": "Company Name or null",
  "mustHave": [{"text": "requirement", "type": "skill|education|certification|experience"}],
  "niceToHave": [{"text": "requirement", "type": "skill|education|certification|experience"}],
  "responsibilities": ["duty1", "duty2"]
}

JOB DESCRIPTION:
`;

function generateToken(): string {
  return randomBytes(16).toString('hex');
}

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  try {
    const body = await request.json();
    const { url, description, expires_in_days = 30 } = body;

    if (!description) {
      return apiError('validation_error', 'description is required', 400);
    }

    // Step 1: Extract opportunity details
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'You are a job posting analyzer. Return ONLY valid JSON.' },
        { role: 'user', content: EXTRACTION_PROMPT + description },
      ],
    });

    const content = response.choices[0]?.message?.content;
    let extracted = {
      title: 'Unknown Position',
      company: null as string | null,
      mustHave: [] as ClassifiedRequirement[],
      niceToHave: [] as ClassifiedRequirement[],
      responsibilities: [] as string[],
    };

    if (content) {
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extracted = JSON.parse(cleaned);
      } catch {
        console.error('Failed to parse extraction');
      }
    }

    const requirements = {
      mustHave: extracted.mustHave,
      niceToHave: extracted.niceToHave,
      responsibilities: extracted.responsibilities,
    };

    const reqTexts = extracted.mustHave.slice(0, 5).map(r => r.text).join('. ');
    const embeddingText = `${extracted.title} at ${extracted.company || 'Unknown'}. ${reqTexts}`;
    const embedding = await generateEmbedding(embeddingText);

    // Step 2: Insert opportunity
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .insert({
        user_id: userId,
        title: extracted.title,
        company: extracted.company,
        url: url || null,
        description,
        requirements: requirements as unknown as Json,
        embedding: embedding as unknown as string,
        status: 'tracking' as const,
      })
      .select('id, title, company')
      .single();

    if (oppError || !opportunity) {
      return apiError('server_error', 'Failed to save opportunity', 500);
    }

    // Step 3: Generate tailored profile
    const profileResult = await generateProfileWithClient(supabase, opportunity.id, userId);

    // Step 4: Create share link
    const expiresAt = new Date();
    if (expires_in_days > 0) {
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    }

    const token = generateToken();
    const { data: shareLink, error: linkError } = await supabase
      .from('shared_links')
      .insert({
        tailored_profile_id: profileResult.profile.id,
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (linkError) {
      console.error('Failed to create share link:', linkError);
      // Don't fail the whole request - opportunity and profile were created
    }

    return apiSuccess({
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        company: opportunity.company,
      },
      profile: {
        id: profileResult.profile.id,
        narrative: profileResult.profile.narrative,
      },
      share_link: shareLink ? {
        token: shareLink.token,
        url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${token}`,
        expires_at: shareLink.expires_at,
      } : null,
    });
  } catch (err) {
    console.error('Add-tailor-share error:', err);
    return apiError('server_error', 'Failed to process request', 500);
  }
}
```

**Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/v1/opportunities/add-tailor-share/route.ts
git commit -m "feat(api): add POST /api/v1/opportunities/add-tailor-share compound endpoint"
```

---

## Task 9: Fix Lib Function Dependencies

The `generateTalkingPoints`, `generateNarrative`, and `generateResume` functions in `src/lib/ai/` use `createClient` internally. We need to verify they work with service role or update them.

**Step 1: Check each function's client usage**

```bash
grep -l "createClient" src/lib/ai/generate-*.ts
```

**Step 2: If they use createClient, refactor to accept client parameter**

For each function that creates its own client, either:
- Add optional `supabase` parameter
- Or create API versions like we did for `match-opportunity-api.ts`

This may require creating:
- `src/lib/ai/generate-talking-points-api.ts`
- Or modifying existing functions to accept optional client

**Step 3: Update generate-profile-api.ts to pass client**

Once the lib functions accept clients, update the calls in `generate-profile-api.ts`.

**Step 4: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/lib/ai/
git commit -m "fix(api): ensure lib functions work with service role client"
```

---

## Task 10: Integration Testing

**Step 1: Start dev server**

```bash
pnpm dev
```

**Step 2: Create test script**

Create a simple test script or run manually:

```bash
# Set your API key
API_KEY="idn_your_key_here"
BASE="http://localhost:3000/api/v1"

# Test POST /opportunities
curl -X POST "$BASE/opportunities" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"description": "Senior Engineer at Acme. Need 5+ years Python, AWS preferred."}' | jq .

# Get the opportunity ID from response, then:
OPP_ID="<id-from-above>"

# Test GET /opportunities/:id
curl "$BASE/opportunities/$OPP_ID" \
  -H "Authorization: Bearer $API_KEY" | jq .

# Test GET /opportunities/:id/match
curl "$BASE/opportunities/$OPP_ID/match" \
  -H "Authorization: Bearer $API_KEY" | jq .

# Test POST /opportunities/:id/tailor
curl -X POST "$BASE/opportunities/$OPP_ID/tailor" \
  -H "Authorization: Bearer $API_KEY" | jq .

# Test GET /opportunities/:id/tailored-profile
curl "$BASE/opportunities/$OPP_ID/tailored-profile" \
  -H "Authorization: Bearer $API_KEY" | jq .

# Test POST /opportunities/:id/share
curl -X POST "$BASE/opportunities/$OPP_ID/share" \
  -H "Authorization: Bearer $API_KEY" | jq .

# Test compound: add-and-tailor
curl -X POST "$BASE/opportunities/add-and-tailor" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"description": "Product Manager at StartupCo. MBA preferred."}' | jq .

# Test compound: add-tailor-share
curl -X POST "$BASE/opportunities/add-tailor-share" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"description": "DevOps Lead at CloudCorp. K8s, Terraform required."}' | jq .
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(api): complete Phase 2 - Opportunity Operations"
```

---

## Summary

Phase 2 delivers:
- `POST /api/v1/opportunities` - Add opportunity from job description
- `GET /api/v1/opportunities/:id` - Get single opportunity
- `GET /api/v1/opportunities/:id/match` - Match analysis with scores
- `POST /api/v1/opportunities/:id/tailor` - Generate tailored profile
- `GET /api/v1/opportunities/:id/tailored-profile` - Get tailored profile
- `POST /api/v1/opportunities/:id/share` - Create share link
- `POST /api/v1/opportunities/add-and-tailor` - Compound: add + tailor
- `POST /api/v1/opportunities/add-tailor-share` - Compound: add + tailor + share

**Files created:**
- `src/app/api/v1/opportunities/[id]/route.ts`
- `src/app/api/v1/opportunities/[id]/match/route.ts`
- `src/app/api/v1/opportunities/[id]/tailor/route.ts`
- `src/app/api/v1/opportunities/[id]/tailored-profile/route.ts`
- `src/app/api/v1/opportunities/[id]/share/route.ts`
- `src/app/api/v1/opportunities/add-and-tailor/route.ts`
- `src/app/api/v1/opportunities/add-tailor-share/route.ts`
- `src/lib/ai/match-opportunity-api.ts`
- `src/lib/ai/generate-profile-api.ts`

**Next:** Phase 3 - Content Input (resume upload, profile updates)
