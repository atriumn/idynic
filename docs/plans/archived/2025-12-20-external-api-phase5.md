# External API Phase 5: Recruiter & Polish

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** Done
**Goal:** Add recruiter-facing AI summary endpoint, rate limiting, and API documentation.

## Progress (Last reviewed: 2025-12-24)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: GET /api/v1/shared/:token/summary | ✅ Complete | Verified shared/[token]/summary |
| Task 2: Rate Limiting Middleware | ✅ Complete | |
| Task 3: OpenAPI Documentation | ✅ Complete | openapi.json exists |

### Drift Notes
None - implementation matches plan

**Architecture:** New public endpoint for AI-generated candidate summaries (no auth required - uses share token). Rate limiting via middleware. OpenAPI spec for documentation.

**Tech Stack:** Next.js API routes, OpenAI for summaries, Upstash Redis for rate limiting (optional), OpenAPI 3.0

---

## Task 1: GET /api/v1/shared/:token/summary - AI Candidate Summary

**Files:**
- Create: `src/app/api/v1/shared/[token]/summary/route.ts`
- Reference: `src/app/api/shared/[token]/route.ts`

**Step 1: Create the summary endpoint**

```typescript
// src/app/api/v1/shared/[token]/summary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import OpenAI from "openai";

const openai = new OpenAI();

const SUMMARY_PROMPT = `You are a recruiter assistant. Given a candidate's profile for a specific job opportunity, write a concise executive summary (2-3 paragraphs) that:

1. Highlights the candidate's most relevant experience and skills for this role
2. Notes key achievements and quantifiable results
3. Identifies any potential gaps or areas to explore in an interview

Be professional, objective, and helpful. Focus on fit for the specific role.

CANDIDATE PROFILE:
{profile}

JOB OPPORTUNITY:
{opportunity}

Write the executive summary:`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  // Use existing RPC to get shared profile data
  const { data, error } = await supabase.rpc("get_shared_profile", {
    p_token: token,
  });

  if (error) {
    console.error("Failed to fetch shared profile:", error);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to fetch profile" } },
      { status: 500 }
    );
  }

  const result = data as {
    error?: string;
    candidate_name?: string;
    candidate?: Record<string, unknown>;
    opportunity?: Record<string, unknown>;
    narrative?: string;
    resumeData?: Record<string, unknown>;
  };

  if (result.error === "not_found") {
    return NextResponse.json(
      { error: { code: "not_found", message: "Share link not found" } },
      { status: 404 }
    );
  }

  if (result.error === "expired" || result.error === "revoked") {
    return NextResponse.json(
      {
        error: {
          code: result.error,
          message: `Share link has ${result.error}`,
          candidate_name: result.candidate_name,
        },
      },
      { status: 410 }
    );
  }

  // Build profile text for AI
  const profileText = JSON.stringify(
    {
      name: result.candidate_name,
      narrative: result.narrative,
      resume: result.resumeData,
    },
    null,
    2
  );

  const opportunityText = JSON.stringify(result.opportunity, null, 2);

  // Generate AI summary
  try {
    const prompt = SUMMARY_PROMPT.replace("{profile}", profileText).replace(
      "{opportunity}",
      opportunityText
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = response.choices[0]?.message?.content || "";

    return NextResponse.json({
      data: {
        candidate_name: result.candidate_name,
        summary,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Failed to generate summary:", err);
    return NextResponse.json(
      { error: { code: "ai_error", message: "Failed to generate summary" } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify and commit**

```bash
pnpm exec tsc --noEmit
git add src/app/api/v1/shared
git commit -m "feat(api): add GET /api/v1/shared/:token/summary for AI candidate summaries"
```

---

## Task 2: Rate Limiting Middleware

**Files:**
- Create: `src/lib/api/rate-limit.ts`
- Modify: `src/lib/api/auth.ts` (add rate limit check)

**Step 1: Create rate limiting utility**

Simple in-memory rate limiter (can upgrade to Redis later):

```typescript
// src/lib/api/rate-limit.ts

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (per-instance, resets on deploy)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No entry or expired - create new
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  // Within window - increment
  entry.count++;

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// Default limits
export const API_RATE_LIMITS = {
  // Authenticated API requests
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  // AI-heavy operations (tailor, summary)
  ai: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 AI requests per minute
  },
  // Public endpoints (shared profiles)
  public: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute per IP
  },
};
```

**Step 2: Add rate limit check to auth**

```typescript
// Add to src/lib/api/auth.ts

import { checkRateLimit, API_RATE_LIMITS } from "./rate-limit";
import { apiError } from "./response";

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return apiError("rate_limited", "Too many requests", 429, {
    "Retry-After": String(retryAfter),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  });
}

// Add to validateApiKey function, after successful auth:
// const rateLimit = checkRateLimit(`api:${userId}`, API_RATE_LIMITS.api);
// if (!rateLimit.allowed) {
//   return rateLimitResponse(rateLimit.resetAt);
// }
```

**Step 3: Update apiError to accept headers**

```typescript
// Modify apiError in src/lib/api/response.ts to accept optional headers

export function apiError(
  code: string,
  message: string,
  status: number = 400,
  headers?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(
    {
      error: {
        code,
        message,
        request_id: generateRequestId(),
      },
    },
    { status }
  );

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
  }

  return response;
}
```

**Step 4: Integrate rate limiting into validateApiKey**

Update the `validateApiKey` function to check rate limits after successful authentication.

**Step 5: Commit**

```bash
git add src/lib/api
git commit -m "feat(api): add rate limiting for API endpoints"
```

---

## Task 3: OpenAPI Specification

**Files:**
- Create: `src/app/api/v1/openapi.json/route.ts`
- Create: `public/openapi.yaml` (optional static file)

**Step 1: Create OpenAPI endpoint**

```typescript
// src/app/api/v1/openapi.json/route.ts

import { NextResponse } from "next/server";

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Idynic API",
    description: "API for Idynic - AI Career Companion",
    version: "1.0.0",
    contact: {
      name: "Idynic Support",
      url: "https://idynic.com",
    },
  },
  servers: [
    {
      url: "https://idynic.com/api/v1",
      description: "Production",
    },
  ],
  security: [
    {
      bearerAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key in format: idn_xxxxxxxx",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              request_id: { type: "string" },
            },
          },
        },
      },
      Profile: {
        type: "object",
        properties: {
          contact: {
            type: "object",
            properties: {
              name: { type: "string", nullable: true },
              email: { type: "string", nullable: true },
              phone: { type: "string", nullable: true },
              location: { type: "string", nullable: true },
              linkedin_url: { type: "string", nullable: true },
              github_url: { type: "string", nullable: true },
              website_url: { type: "string", nullable: true },
            },
          },
          experience: { type: "array", items: { $ref: "#/components/schemas/WorkHistory" } },
          skills: { type: "array", items: { $ref: "#/components/schemas/Claim" } },
          education: { type: "array", items: { $ref: "#/components/schemas/Claim" } },
          certifications: { type: "array", items: { $ref: "#/components/schemas/Claim" } },
        },
      },
      Claim: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          type: { type: "string" },
          label: { type: "string" },
          description: { type: "string", nullable: true },
          confidence: { type: "number" },
        },
      },
      WorkHistory: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          company: { type: "string" },
          title: { type: "string" },
          start_date: { type: "string", nullable: true },
          end_date: { type: "string", nullable: true },
          summary: { type: "string", nullable: true },
        },
      },
      Opportunity: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          company: { type: "string", nullable: true },
          url: { type: "string", nullable: true },
          status: { type: "string" },
          match_score: { type: "number", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/profile": {
      get: {
        summary: "Get user profile",
        tags: ["Profile"],
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Profile" },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
      patch: {
        summary: "Update profile contact info",
        tags: ["Profile"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  location: { type: "string" },
                  linkedin: { type: "string" },
                  github: { type: "string" },
                  website: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated contact info" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/claims": {
      get: {
        summary: "Get identity claims",
        tags: ["Claims"],
        responses: {
          "200": {
            description: "List of claims",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Claim" },
                },
              },
            },
          },
        },
      },
    },
    "/opportunities": {
      get: {
        summary: "List opportunities",
        tags: ["Opportunities"],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string" },
            description: "Filter by status",
          },
        ],
        responses: {
          "200": {
            description: "List of opportunities",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Opportunity" },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Add opportunity",
        tags: ["Opportunities"],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["description"],
                properties: {
                  url: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Created opportunity" },
        },
      },
    },
    "/shared/{token}": {
      get: {
        summary: "Get shared profile (public)",
        tags: ["Shared"],
        security: [],
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Shared profile data" },
          "404": { description: "Not found" },
          "410": { description: "Expired or revoked" },
        },
      },
    },
    "/shared/{token}/summary": {
      get: {
        summary: "Get AI candidate summary (public)",
        tags: ["Shared"],
        security: [],
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "AI-generated summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    candidate_name: { type: "string" },
                    summary: { type: "string" },
                    generated_at: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/openapi.json
git commit -m "docs(api): add OpenAPI 3.0 specification endpoint"
```

---

## Task 4: API Usage Tracking

**Files:**
- Modify: `src/lib/api/auth.ts` (update last_used_at)
- Create: `src/app/api/v1/usage/route.ts` (usage stats endpoint)

**Step 1: Ensure last_used_at is updated**

The `validateApiKey` function should already update `last_used_at`. Verify this is working.

**Step 2: Create usage stats endpoint**

```typescript
// src/app/api/v1/usage/route.ts

import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  // Get API key stats
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, key_prefix, name, last_used_at, created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  // Get document counts
  const { count: documentCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get opportunity counts
  const { count: opportunityCount } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get share link counts
  const { count: shareLinkCount } = await supabase
    .from("share_links")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);

  return apiSuccess({
    api_keys: keys?.map((k) => ({
      prefix: k.key_prefix,
      name: k.name,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
    })),
    counts: {
      documents: documentCount || 0,
      opportunities: opportunityCount || 0,
      active_share_links: shareLinkCount || 0,
    },
  });
}
```

**Step 3: Commit**

```bash
git add src/app/api/v1/usage
git commit -m "feat(api): add GET /api/v1/usage for API usage stats"
```

---

## Task 5: Integration Testing & Final Commit

**Step 1: Test all new endpoints**

```bash
# Test summary endpoint (need a valid share token)
curl "http://localhost:3000/api/v1/shared/YOUR_TOKEN/summary"

# Test OpenAPI spec
curl "http://localhost:3000/api/v1/openapi.json" | jq .info

# Test usage endpoint
curl "http://localhost:3000/api/v1/usage" \
  -H "Authorization: Bearer idn_xxx"
```

**Step 2: Run type check and lint**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(api): complete Phase 5 - Recruiter & Polish"
```

---

## Summary

Phase 5 delivers:
- `GET /api/v1/shared/:token/summary` - AI-generated candidate summary for recruiters
- Rate limiting utility with configurable limits
- OpenAPI 3.0 specification at `/api/v1/openapi.json`
- Usage stats endpoint at `/api/v1/usage`

**Files created:**
- `src/app/api/v1/shared/[token]/summary/route.ts`
- `src/lib/api/rate-limit.ts`
- `src/app/api/v1/openapi.json/route.ts`
- `src/app/api/v1/usage/route.ts`

**Files modified:**
- `src/lib/api/auth.ts` (rate limiting integration)
- `src/lib/api/response.ts` (headers support)

**Next:** npm publish @idynic/mcp-server, production deployment
