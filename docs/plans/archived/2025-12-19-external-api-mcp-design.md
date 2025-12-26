# External API & MCP Server Design

**Date:** 2025-12-19
**Status:** Approved

## Overview

Expose Idynic functionality via REST API and MCP server for external consumption. This enables job seekers to manage their profiles through AI assistants (Claude, ChatGPT), recruiters to access shared profiles programmatically, and third-party integrations (job boards, ATS systems, browser extensions).

## Priority Order

1. **Job seekers via AI assistants** — highest leverage, most differentiated
2. **Recruiters/hiring tools** — natural fit with existing shared links
3. **Third-party integrations** — broader but more complex

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Clients                          │
├─────────────────┬───────────────────────┬───────────────────────┤
│   AI Assistants │   Browser Extensions  │   Third-party Apps    │
│  (Claude, etc.) │   Job Board Plugins   │   ATS Integrations    │
└────────┬────────┴───────────┬───────────┴───────────┬───────────┘
         │                    │                       │
         ▼                    │                       │
┌─────────────────┐           │                       │
│  MCP Server     │           │                       │
│  (@idynic/mcp)  │           │                       │
│                 │           │                       │
│  - Tools        │           │                       │
│  - Resources    │           │                       │
└────────┬────────┘           │                       │
         │                    │                       │
         ▼                    ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REST API (/api/v1/...)                        │
│                                                                  │
│  Auth: API Keys (Authorization: Bearer idn_xxx)                  │
│  Format: JSON, Streaming SSE for long operations                 │
├─────────────────────────────────────────────────────────────────┤
│                    Next.js API Routes                            │
│                    (existing + new v1 endpoints)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase                                      │
│  - PostgreSQL + pgvector (data)                                  │
│  - Auth (user sessions, separate from API keys)                  │
│  - Storage (resume PDFs)                                         │
│  - RLS (API keys mapped to user_id for same access control)      │
└─────────────────────────────────────────────────────────────────┘
```

**Key decisions:**
- MCP server is a thin wrapper calling REST API
- All clients use same REST endpoints with API key auth
- Existing RLS rules apply (API key → user_id mapping)
- Long operations stream via SSE

## REST API Endpoints

**Base path:** `/api/v1`
**Auth header:** `Authorization: Bearer idn_xxxxxxxxxxxx`

### Tier 1: Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/opportunities` | Add opportunity (URL or raw text) |
| `GET` | `/opportunities` | List all with match scores |
| `GET` | `/opportunities/:id` | Get single with full details |
| `GET` | `/opportunities/:id/match` | Match analysis (strengths, gaps, score) |
| `POST` | `/opportunities/:id/tailor` | Generate tailored profile (SSE stream) |
| `GET` | `/opportunities/:id/tailored-profile` | Get generated profile |
| `POST` | `/opportunities/:id/share` | Create share link |
| `GET` | `/profile` | Full profile (contact, work history, claims) |
| `GET` | `/claims` | Identity claims with confidence |

### Tier 1: Compound Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/opportunities/add-and-tailor` | Add + generate profile (SSE) |
| `POST` | `/opportunities/add-tailor-share` | Add + generate + share link (SSE) |

### Tier 2: Content & Editing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/documents/resume` | Upload resume PDF (SSE stream) |
| `POST` | `/documents/story` | Add story text (SSE stream) |
| `PATCH` | `/profile` | Update contact info |
| `PATCH` | `/profile/work-history/:id` | Update work entry |
| `PATCH` | `/opportunities/:id/tailored-profile` | Edit section (direct or AI-assisted) |
| `GET` | `/share-links` | List active share links |
| `DELETE` | `/share-links/:token` | Revoke share link |

### Tier 3: Recruiter (No auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/shared/:token` | View shared profile |
| `GET` | `/shared/:token/summary` | AI-generated candidate summary |

## MCP Server

**Package:** `@idynic/mcp-server`

**Installation:**
```bash
npx @idynic/mcp-server --api-key idn_xxx
```

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "idynic": {
      "command": "npx",
      "args": ["@idynic/mcp-server"],
      "env": {
        "IDYNIC_API_KEY": "idn_xxx"
      }
    }
  }
}
```

### Tools

| Tool | Description | Maps to |
|------|-------------|---------|
| `add_opportunity` | Add job posting by URL or text | `POST /opportunities` |
| `list_opportunities` | List tracked jobs with match % | `GET /opportunities` |
| `analyze_match` | Get strengths/gaps for a job | `GET /opportunities/:id/match` |
| `generate_tailored_profile` | Create tailored resume/narrative | `POST /opportunities/:id/tailor` |
| `create_share_link` | Get shareable link | `POST /opportunities/:id/share` |
| `add_and_tailor` | Add job + generate profile in one | `POST /opportunities/add-and-tailor` |
| `add_tailor_share` | Add + tailor + share in one | `POST /opportunities/add-tailor-share` |
| `get_profile` | View full profile | `GET /profile` |
| `get_claims` | View identity claims | `GET /claims` |
| `upload_resume` | Add resume (base64 PDF) | `POST /documents/resume` |
| `add_story` | Add career story | `POST /documents/story` |
| `edit_profile` | Update profile fields | `PATCH /profile` |
| `view_shared_profile` | View candidate (recruiter) | `GET /shared/:token` |

### Resources

| Resource URI | Description |
|--------------|-------------|
| `idynic://profile` | Current user profile |
| `idynic://claims` | Identity claims list |
| `idynic://opportunities` | Tracked opportunities |
| `idynic://opportunities/{id}` | Single opportunity details |
| `idynic://share-links` | Active share links |

## API Key Management

### Database Schema

```sql
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  key_hash text not null,              -- SHA-256 hash of key
  key_prefix text not null,            -- First 8 chars for display (idn_abc1...)
  name text not null,                  -- User-provided label
  scopes text[] default '{}',          -- Future: limit permissions
  last_used_at timestamptz,
  expires_at timestamptz,              -- Optional expiration
  revoked_at timestamptz,
  created_at timestamptz default now(),

  constraint valid_key_prefix check (key_prefix ~ '^idn_[a-z0-9]{4}$')
);

create index api_keys_hash_idx on api_keys(key_hash) where revoked_at is null;
```

### Key Format

```
idn_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
└─┬─┘└──────────────────────────────┘
prefix    32 random bytes (hex)
```

### Auth Flow

1. Request arrives with `Authorization: Bearer idn_xxx`
2. Hash the key with SHA-256
3. Look up `api_keys` by `key_hash` where `revoked_at is null`
4. Check `expires_at` if set
5. Get `user_id`, use for RLS context
6. Update `last_used_at`

### Dashboard UI

New page at `/settings/api-keys`:
- Create new key (shows full key once, then only prefix)
- List keys with name, prefix, last used, created
- Revoke keys

## Response Formats

### Success Responses

**Standard response:**
```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_abc123"
  }
}
```

**List response:**
```json
{
  "data": [ ... ],
  "meta": {
    "request_id": "req_abc123",
    "count": 12,
    "has_more": false
  }
}
```

**Streaming response (SSE):**
```
data: {"phase": "parsing", "message": "Extracting resume content..."}
data: {"phase": "extracting", "progress": "3/10", "message": "Found: Project Management"}
data: {"phase": "done", "data": { ... }}
```

### Error Responses

```json
{
  "error": {
    "code": "invalid_api_key",
    "message": "API key is invalid or revoked",
    "request_id": "req_abc123"
  }
}
```

**Error codes:**

| Code | HTTP | Description |
|------|------|-------------|
| `invalid_api_key` | 401 | Key missing, malformed, or revoked |
| `expired_api_key` | 401 | Key past expiration |
| `not_found` | 404 | Resource doesn't exist |
| `validation_error` | 400 | Invalid request body |
| `rate_limited` | 429 | Too many requests |
| `processing_failed` | 500 | AI/extraction error |
| `duplicate_content` | 409 | Resume/story already uploaded |

### Rate Limiting

- **Default:** 100 requests/minute per API key
- **Streaming endpoints:** 10 concurrent per key
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## File Structure

```
idynic/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/                          # New external API
│   │   │   │   ├── middleware.ts            # API key auth
│   │   │   │   ├── opportunities/
│   │   │   │   │   ├── route.ts             # GET list, POST create
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── route.ts         # GET single
│   │   │   │   │   │   ├── match/route.ts
│   │   │   │   │   │   ├── tailor/route.ts
│   │   │   │   │   │   ├── tailored-profile/route.ts
│   │   │   │   │   │   └── share/route.ts
│   │   │   │   │   ├── add-and-tailor/route.ts
│   │   │   │   │   └── add-tailor-share/route.ts
│   │   │   │   ├── profile/route.ts
│   │   │   │   ├── claims/route.ts
│   │   │   │   ├── documents/
│   │   │   │   │   ├── resume/route.ts
│   │   │   │   │   └── story/route.ts
│   │   │   │   ├── share-links/route.ts
│   │   │   │   └── shared/[token]/route.ts
│   │   │   └── ...                          # Existing internal API
│   │   ├── settings/
│   │   │   └── api-keys/                    # Key management UI
│   │   │       └── page.tsx
│   │   └── ...
│   └── lib/
│       ├── api/
│       │   ├── auth.ts                      # API key validation
│       │   ├── response.ts                  # Standard response helpers
│       │   └── rate-limit.ts                # Rate limiting
│       └── ...
├── packages/
│   └── mcp-server/                          # MCP Server package
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                     # Entry point
│       │   ├── server.ts                    # MCP server setup
│       │   ├── tools/                       # Tool implementations
│       │   │   ├── opportunities.ts
│       │   │   ├── profile.ts
│       │   │   ├── documents.ts
│       │   │   └── sharing.ts
│       │   ├── resources/                   # Resource handlers
│       │   └── client.ts                    # REST API client
│       └── bin/
│           └── cli.ts                       # npx entry
└── ...
```

## Implementation Phases

### Phase 1: Foundation
1. Database: `api_keys` table + migration
2. API key auth middleware
3. API key management UI (`/settings/api-keys`)
4. Core endpoints: `GET /profile`, `GET /claims`, `GET /opportunities`

### Phase 2: Opportunity Operations
1. `POST /opportunities` (add)
2. `GET /opportunities/:id/match` (analysis)
3. `POST /opportunities/:id/tailor` (generate, SSE)
4. `POST /opportunities/:id/share` (create link)
5. Compound: `add-and-tailor`, `add-tailor-share`

### Phase 3: Content Input
1. `POST /documents/resume` (upload, SSE)
2. `POST /documents/story` (add, SSE)
3. `PATCH /profile` (update contact/work history)
4. `PATCH /opportunities/:id/tailored-profile` (edit)

### Phase 4: MCP Server
1. Package setup (`packages/mcp-server`)
2. REST client wrapper
3. Tools implementation (mirrors REST endpoints)
4. Resources implementation
5. CLI entry point + npm publishing

### Phase 5: Recruiter & Polish
1. `GET /shared/:token/summary` (AI summary)
2. Rate limiting implementation
3. API documentation (OpenAPI spec)
4. Dashboard analytics (API usage)
