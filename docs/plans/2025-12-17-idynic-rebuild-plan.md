# Idynic Rebuild Plan

**Status:** 🎉 MVP COMPLETE + Extended Features
**Created:** 2025-12-17
**Last Reviewed:** 2025-12-20
**Decision:** Full rebuild on Supabase + Vercel, nuke existing AWS infrastructure

---

## Progress Summary (2025-12-20)

All MVP features complete, plus significant extensions beyond original scope.

### MVP Features (All Complete ✅)
| Feature | Status | Notes |
|---------|--------|-------|
| Resume Upload | ✅ Complete | SSE streaming, ~60-90s processing |
| Identity Synthesis | ✅ Complete | Two-layer model (evidence + claims) |
| Opportunity Tracking | ✅ Complete | Add, edit, delete opportunities |
| Profile Tailoring | ✅ Complete | Tailored resume + cover letter |

### Extended Features (All Complete ✅)
| Feature | Status | Notes |
|---------|--------|-------|
| Story Capture | ✅ Complete | Originally NOT in scope |
| Profile Sharing | ✅ Complete | Share links with view tracking |
| PDF Generation | ✅ Complete | @react-pdf/renderer |
| Editable Content | ✅ Complete | AI-assisted refinement |
| Profile Management | ✅ Complete | Full CRUD for all sections |
| External API | ✅ Complete | API keys + v1 endpoints (PR #6) |

### Archived Implementation Plans
- `2025-12-17-identity-synthesis-implementation.md` ✅
- `2025-12-18-resume-upload-performance-plan.md` ✅
- `2025-12-18-story-extraction-plan.md` ✅
- `2025-12-18-profile-tailoring-plan.md` ✅
- `2025-12-18-pdf-resume-generation.md` ✅
- `2025-12-19-profile-sharing-implementation.md` ✅
- `2025-12-19-editable-tailored-content.md` ✅
- `2025-12-19-profile-management-plan.md` ✅
- `2025-12-19-external-api-phase1.md` ✅

---

## Overview

A complete rebuild of Idynic on a simpler stack. We're nuking the existing 26 DynamoDB tables, 8 Lambda functions, and complex CDK infrastructure in favor of:

- **Database:** Supabase (Postgres + pg_vector + Auth + Storage)
- **Frontend:** Next.js 14 on Vercel
- **AI:** OpenAI (GPT-4o-mini for extraction, text-embedding-3-small for vectors)
- **UI:** shadcn/ui + Tailwind CSS

### Why

- 0 users - no migration risk
- Current stack costs ~$200-500/month idle, new stack ~$50/month
- Current codebase has too much cruft confusing humans and LLMs
- 5 tables instead of 26, 1 app instead of 8 Lambda functions
- 10x faster iteration

### MVP Scope

**Building:**

1. Resume upload → AI extracts claims → stored with embeddings
2. Opportunity/job tracking → AI extracts requirements → stored with embeddings
3. Matching → vector similarity shows how your profile matches each job

**NOT building (yet):**

- ~~Story capture~~ ✅ Built on 2025-12-18
- Gmail integration
- Interview prep
- ~~Public sharing/profiles~~ ✅ Built on 2025-12-19
- Kanban board

---

## Decisions

| Decision      | Choice                                                  |
| ------------- | ------------------------------------------------------- |
| Domain        | Keep `idynic.com`, repoint to Vercel                    |
| Repository    | New repo `idynic-rebuild`, rename to `idynic` when live |
| AWS           | Full nuke both dev and prod accounts                    |
| UI Library    | shadcn/ui (Radix + Tailwind)                            |
| AI Model      | GPT-4o-mini for all extraction (~$0.001/resume)         |
| Embeddings    | text-embedding-3-small (1536 dims)                      |
| Vector Search | pg_vector in Supabase                                   |

---

## Database Schema

5 tables, all in Postgres with pg_vector.

```sql
-- Enable vector extension
create extension if not exists vector;

-- 1. Profiles (extends Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Documents (resumes, stories)
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null check (type in ('resume', 'story')),
  filename text,
  storage_path text,
  raw_text text,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz default now()
);

-- 3. Claims (extracted facts)
create table claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  document_id uuid references documents(id) on delete cascade,
  claim_type text not null,
  value jsonb not null,
  evidence_text text,
  confidence float default 1.0,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- 4. Opportunities (jobs)
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  company text,
  url text,
  description text,
  requirements jsonb,
  status text default 'tracking' check (status in ('tracking', 'applied', 'interviewing', 'offer', 'rejected', 'archived')),
  embedding vector(1536),
  created_at timestamptz default now()
);

-- 5. Matches (claim <-> opportunity scores)
create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  opportunity_id uuid references opportunities(id) on delete cascade not null,
  claim_id uuid references claims(id) on delete cascade not null,
  score float not null,
  created_at timestamptz default now(),
  unique(opportunity_id, claim_id)
);

-- Indexes
create index claims_user_id_idx on claims(user_id);
create index claims_embedding_idx on claims using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index opportunities_user_id_idx on opportunities(user_id);
create index opportunities_embedding_idx on opportunities using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index matches_opportunity_idx on matches(opportunity_id);

-- Row Level Security
alter table profiles enable row level security;
alter table documents enable row level security;
alter table claims enable row level security;
alter table opportunities enable row level security;
alter table matches enable row level security;

create policy "Users can view own profile" on profiles for all using (auth.uid() = id);
create policy "Users can manage own documents" on documents for all using (auth.uid() = user_id);
create policy "Users can manage own claims" on claims for all using (auth.uid() = user_id);
create policy "Users can manage own opportunities" on opportunities for all using (auth.uid() = user_id);
create policy "Users can manage own matches" on matches for all using (auth.uid() = user_id);

-- Vector search function
create or replace function match_claims(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  claim_type text,
  value jsonb,
  evidence_text text,
  similarity float
)
language sql stable
as $$
  select
    claims.id,
    claims.claim_type,
    claims.value,
    claims.evidence_text,
    1 - (claims.embedding <=> query_embedding) as similarity
  from claims
  where claims.user_id = match_user_id
    and 1 - (claims.embedding <=> query_embedding) > match_threshold
  order by claims.embedding <=> query_embedding
  limit match_count;
$$;
```

---

## Project Structure

```
idynic-rebuild/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── identity/page.tsx
│   │   ├── opportunities/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── api/
│   │       ├── process-resume/route.ts
│   │       └── process-opportunity/route.ts
│   ├── components/
│   │   ├── ui/                   # shadcn/ui
│   │   ├── resume-upload.tsx
│   │   ├── claims-list.tsx
│   │   ├── opportunity-card.tsx
│   │   ├── match-analysis.tsx
│   │   └── nav.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── ai/
│   │   │   ├── extract-resume.ts
│   │   │   ├── extract-job.ts
│   │   │   └── embeddings.ts
│   │   └── utils.ts
│   └── styles/globals.css
├── supabase/
│   ├── migrations/001_initial_schema.sql
│   └── config.toml
├── public/
├── .env.local
├── next.config.js
├── tailwind.config.js
├── components.json
└── package.json
```

---

## AI Approach

### Resume Extraction

- **Model:** GPT-4o-mini
- **Cost:** ~$0.001 per resume
- **Output:** `{ contact, skills[], experience[], education[] }`

### Job Extraction

- **Model:** GPT-4o-mini
- **Cost:** ~$0.001 per job
- **Output:** `{ title, company, requirements: { mustHave[], niceToHave[] } }`

### Embeddings

- **Model:** text-embedding-3-small
- **Cost:** ~$0.00002 per embedding
- **Dimensions:** 1536

### Matching

- Vector similarity via pg_vector
- Threshold: 0.3 (tunable)
- No canonical resolution - embeddings handle similarity directly

---

## Task Breakdown

### Phase 0: Teardown (~2 hours) ✅ COMPLETE

| #   | Task                                                      | Done |
| --- | --------------------------------------------------------- | ---- |
| 0.1 | Copy extraction prompts from old codebase to scratch file | [x]  |
| 0.2 | Run `cdk destroy --all` on dev account (240966655244)     | [x]  |
| 0.3 | Empty and delete S3 buckets (dev)                         | [x]  |
| 0.4 | Delete Cognito user pool (dev)                            | [x]  |
| 0.5 | Repeat 0.2-0.4 for prod account (485726842524)            | [x]  |
| 0.6 | Rename GitHub repo: `idynic` → `idynic-archive`           | [x]  |

**Note:** AWS infrastructure destroyed. Old repo archived at `atriumn/idynic-archive`.

### Phase 1: Foundation (~2 hours) ✅ COMPLETE

| #   | Task                                       | Done |
| --- | ------------------------------------------ | ---- |
| 1.1 | Create new GitHub repo `idynic`            | [x]  |
| 1.2 | Initialize Next.js 14 with App Router      | [x]  |
| 1.3 | Add Tailwind CSS                           | [x]  |
| 1.4 | Add shadcn/ui, install base components     | [x]  |
| 1.5 | Create Supabase project                    | [x]  |
| 1.6 | Run database migration (5 tables + vector) | [x]  |
| 1.7 | Connect Vercel to repo                     | [x]  |
| 1.8 | Set environment variables in Vercel        | [x]  |

### Phase 2: Auth (~3 hours) ✅ COMPLETE

| #   | Task                                      | Done |
| --- | ----------------------------------------- | ---- |
| 2.1 | Set up Supabase client (browser + server) | [x]  |
| 2.2 | Create login page with Supabase Auth UI   | [x]  |
| 2.3 | Add auth middleware (protect routes)      | [x]  |
| 2.4 | Create profile on first login             | [x]  |
| 2.5 | Add simple nav with logout                | [x]  |

### Phase 3: Resume Upload + Extraction (~4 hours) ✅ COMPLETE

| #    | Task                                   | Done |
| ---- | -------------------------------------- | ---- |
| 3.1  | Create upload UI component (drag-drop) | [x]  |
| 3.2  | Upload file to Supabase Storage        | [x]  |
| 3.3  | Extract text from PDF (unpdf)          | [x]  |
| 3.4  | Create document record in DB           | [x]  |
| 3.5  | Call GPT-4o-mini for extraction        | [x]  |
| 3.6  | Convert extraction to claims           | [x]  |
| 3.7  | Generate embeddings for claims (batch) | [x]  |
| 3.8  | Store claims with embeddings           | [x]  |
| 3.9  | Update document status to 'completed'  | [x]  |
| 3.10 | Show success in UI                     | [x]  |

**Note:** Used `unpdf` instead of `pdf-parse` due to Next.js compatibility issues.

### Phase 4: Identity View (~2 hours) ✅ COMPLETE

| #   | Task                                | Done |
| --- | ----------------------------------- | ---- |
| 4.1 | Create `/identity` page             | [x]  |
| 4.2 | Fetch user's claims from DB         | [x]  |
| 4.3 | Group claims by type                | [x]  |
| 4.4 | Display claims in clean UI          | [x]  |
| 4.5 | Show source document for each claim | [x]  |

**Note:** Source documents shown in identity-claims-list.tsx (lines 80-87, 114-118).

### Phase 5: Opportunities (~4 hours) ✅ COMPLETE

| #   | Task                                | Done |
| --- | ----------------------------------- | ---- |
| 5.1 | Create `/opportunities` page        | [x]  |
| 5.2 | Create "Add opportunity" form       | [x]  |
| 5.3 | Call GPT-4o-mini for job extraction | [x]  |
| 5.4 | Generate embedding for opportunity  | [x]  |
| 5.5 | Store opportunity in DB             | [x]  |
| 5.6 | List opportunities with basic info  | [x]  |
| 5.7 | Add status badges                   | [x]  |

### Phase 6: Matching (~3 hours) ✅ COMPLETE

| #   | Task                                      | Done |
| --- | ----------------------------------------- | ---- |
| 6.1 | Create vector search function in Postgres | [x]  |
| 6.2 | On opportunity save, compute matches      | [x]  |
| 6.3 | Create `/opportunities/[id]` detail page  | [x]  |
| 6.4 | Display match score prominently           | [x]  |
| 6.5 | Show matched claims                       | [x]  |
| 6.6 | Show gaps (requirements without matches)  | [x]  |

**Note:** Matching uses `match_identity_claims` RPC with vector search. Scores show overall, must-have, and nice-to-have percentages.

### Phase 7: Polish (~ongoing) ✅ COMPLETE

| #   | Task                             | Done |
| --- | -------------------------------- | ---- |
| 7.1 | Loading states (skeletons)       | [x]  |
| 7.2 | Empty states                     | [x]  |
| 7.3 | Error handling                   | [x]  |
| 7.4 | Mobile responsive                | [x]  |
| 7.5 | Dark mode                        | [x]  |
| 7.6 | Visual polish (animations, etc.) | [x]  |

**Note:** Loading states in tailored-profile.tsx. Empty states in identity, opportunities, tailored-profile. Error handling with try-again buttons. Responsive grids throughout. Dark mode via Tailwind dark: classes.

### Phase 8: Go Live (~1 hour) ✅ COMPLETE

| #   | Task                                     | Done |
| --- | ---------------------------------------- | ---- |
| 8.1 | Point `idynic.com` DNS to Vercel         | [x]  |
| 8.2 | Update Supabase Site URL                 | [x]  |
| 8.3 | Rename repo: `idynic-rebuild` → `idynic` | [x]  |
| 8.4 | Archive `idynic-archive` repo            | [x]  |

**Note:** Domain `idynic.com` now points to new Vercel deployment. Old repo archived. Supabase Site URL: https://supabase.com/dashboard/project/rqknwvbdomkcbejcxsqz/auth/url-configuration

---

## Testing Strategy

**Approach:** Unit tests for core logic + Integration tests for flows. Skip UI component tests initially.

### What Gets Unit Tested

| Module                     | What to Test                                          |
| -------------------------- | ----------------------------------------------------- |
| `lib/ai/extract-resume.ts` | Parses GPT response correctly, handles malformed JSON |
| `lib/ai/extract-job.ts`    | Extracts requirements, handles edge cases             |
| `lib/ai/embeddings.ts`     | Batching works, handles API errors                    |
| `lib/matching.ts`          | Score calculation, threshold filtering                |
| API routes                 | Auth checks, input validation, error responses        |

### What Gets Integration Tested

| Flow                 | Test                                               |
| -------------------- | -------------------------------------------------- |
| Resume upload        | File → Storage → DB record created                 |
| Resume extraction    | Upload → AI called → Claims stored with embeddings |
| Opportunity matching | Add job → Matches computed → Correct claims linked |
| Auth flow            | Sign up → Profile created → Protected routes work  |

### Test Setup

```
vitest                 # Fast, ESM-native test runner
@testing-library/react # For any UI tests later
msw                    # Mock OpenAI/Supabase in tests
```

### Running Tests

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode during development
pnpm test:coverage     # Coverage report
```

### Contract Tests (Supabase Schema)

Validate that the database schema matches expectations:

- Tables exist with correct columns
- RLS policies are enabled
- Vector search function works

### Future: Evals / Sampling

Phase 7+ concern. Once real data flows:

- Sample extraction outputs for quality review
- Track match accuracy over time
- A/B test prompt variations

---

## Documentation Strategy

**Approach:** Minimal, living documentation. Two files.

### README.md

For humans. Setup and operations.

```markdown
# Idynic

Smart career companion - upload resume, track opportunities, see how you match.

## Quick Start

pnpm install
cp .env.example .env.local

# Fill in Supabase + OpenAI keys

pnpm dev

## Scripts

- pnpm dev # Local development
- pnpm test # Run tests
- pnpm build # Production build
- pnpm lint # Lint check

## Deployment

Push to main → Vercel auto-deploys

## Environment Variables

See .env.example
```

### CLAUDE.md

For AI assistants and architecture context. The source of truth.

**Sections:**

1. **Project Overview** - What this is, stack, key decisions
2. **Architecture** - Data flow, key modules, why we chose X
3. **Conventions** - Code patterns, naming, file structure
4. **Testing** - How to run, what to test, patterns
5. **Common Tasks** - How to add a feature, fix a bug
6. **Gotchas** - Known issues, edge cases, things that break

**Maintenance Rule:** When you change something significant, update CLAUDE.md in the same PR.

### What We DON'T Have

- No `/docs` folder with dozens of markdown files
- No separate architecture docs (it's in CLAUDE.md)
- No ADRs (decisions are inline in CLAUDE.md)
- No specs folder (we build, not spec)

---

## Claude Hooks & Configuration

### What to Bring Over

Three hooks from the current repo, updated for the new stack.

#### settings.json

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/validate-changes.sh",
            "timeout": 120
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/test-failure-context.sh"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/prompt-context.sh"
          }
        ]
      }
    ]
  }
}
```

#### prompt-context.sh (unchanged)

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$CLAUDE_PROJECT_DIR" || exit 0
cat <<EOF
<git-context>
Current branch: $(git branch --show-current)

Git status:
$(git status --short)

Recent commits:
$(git log --oneline -5)
</git-context>
EOF
exit 0
```

#### test-failure-context.sh (unchanged)

```bash
#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_result.exit_code // 0')

if [[ ! "$COMMAND" =~ (pnpm)[[:space:]]+(test) ]]; then
  exit 0
fi

if [ "$EXIT_CODE" -eq 0 ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

echo ""
echo "=== Test Failure Context ==="
echo "Recent changes that may have caused the failure:"
git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null | head -10 || true
git status --short 2>/dev/null || true
git log --oneline -3 2>/dev/null || true
exit 0
```

#### validate-changes.sh (updated for pnpm)

```bash
#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1

echo "🔍 Validating $FILE_PATH..."
pnpm format 2>&1 || { echo "❌ Format failed" >&2; exit 2; }
pnpm lint 2>&1 || { echo "❌ Lint failed" >&2; exit 2; }
pnpm typecheck 2>&1 || { echo "❌ Typecheck failed" >&2; exit 2; }
echo "✅ Passed"
exit 0
```

### New Hooks to Add

#### complexity-guard.sh

Warn when files exceed 300 lines.

```bash
#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

LINE_COUNT=$(wc -l < "$FILE_PATH" | tr -d ' ')
if [ "$LINE_COUNT" -gt 300 ]; then
  echo "⚠️  Warning: $FILE_PATH is $LINE_COUNT lines (max 300). Consider splitting." >&2
fi

exit 0
```

#### docs-reminder.sh

Remind to update CLAUDE.md when core logic changes.

```bash
#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" =~ src/lib/ ]] || [[ "$FILE_PATH" =~ src/app/api/ ]]; then
  echo "💡 Reminder: If this is a significant change, update CLAUDE.md" >&2
fi

exit 0
```

### What NOT to Bring

- `verify-aws-profile.sh` - No more AWS/CDK
- All `speckit.*` commands - No spec-driven workflow, we build directly

---

## Automated Guardrails (CI)

These run in GitHub Actions on every PR.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test

      # Complexity guards
      - name: Check file sizes
        run: |
          find src -name "*.ts" -o -name "*.tsx" | while read f; do
            lines=$(wc -l < "$f")
            if [ "$lines" -gt 300 ]; then
              echo "❌ $f has $lines lines (max 300)"
              exit 1
            fi
          done

      - name: Check component count
        run: |
          count=$(find src/components -name "*.tsx" | wc -l)
          if [ "$count" -gt 30 ]; then
            echo "❌ Too many components: $count (max 30)"
            exit 1
          fi

      - name: Check dependency count
        run: |
          count=$(jq '.dependencies | length' package.json)
          if [ "$count" -gt 30 ]; then
            echo "❌ Too many dependencies: $count (max 30)"
            exit 1
          fi

      - name: Check API route count
        run: |
          count=$(find src/app/api -name "route.ts" | wc -l)
          if [ "$count" -gt 5 ]; then
            echo "❌ Too many API routes: $count (max 5)"
            exit 1
          fi

      - name: Check CLAUDE.md freshness
        if: github.event_name == 'pull_request'
        run: |
          core_changed=$(git diff --name-only origin/main | grep -E "^src/lib/|^src/app/api/" | wc -l)
          claude_changed=$(git diff --name-only origin/main | grep "CLAUDE.md" | wc -l)
          if [ "$core_changed" -gt 0 ] && [ "$claude_changed" -eq 0 ]; then
            echo "⚠️ Core logic changed but CLAUDE.md wasn't updated"
            echo "Please update CLAUDE.md to reflect the changes"
            exit 1
          fi
```

### Guardrail Summary

| Check               | Limit                    | Enforcement       |
| ------------------- | ------------------------ | ----------------- |
| File size           | 300 lines                | CI + hook warning |
| Components          | 30 max                   | CI                |
| Dependencies        | 30 max                   | CI                |
| API routes          | 5 max                    | CI                |
| CLAUDE.md freshness | Update with core changes | CI                |
| Format/Lint/Types   | Must pass                | Hook + CI         |
| Tests               | Must pass                | CI                |

---

## Security

### Built-in (Supabase)

- **Row Level Security (RLS)** - Users can only access their own data (enforced at DB level)
- **Auth** - Supabase Auth handles sessions, tokens, password hashing
- **HTTPS** - All traffic encrypted (Supabase + Vercel default)
- **API keys** - Service role key never exposed to client

### Enforceable Security (CI Blocks PRs)

#### 1. Secret Scanning (Pre-commit + CI)

```bash
# Install gitleaks
brew install gitleaks  # or download binary

# .github/workflows/security.yml
name: Security
on: [push, pull_request]

jobs:
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Pre-commit hook** (`.claude/hooks/secret-scan.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run gitleaks on staged changes
if command -v gitleaks &> /dev/null; then
  gitleaks protect --staged --no-banner 2>&1 || {
    echo "❌ BLOCKED: Potential secret detected in staged changes"
    exit 2
  }
fi
exit 0
```

#### 2. Dependency Audit (CI Blocks on High Severity)

```yaml
# In .github/workflows/security.yml
dependency-audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
    - run: pnpm audit --audit-level=high
```

#### 3. RLS Verification Tests (CI)

```typescript
// src/lib/supabase/__tests__/rls.test.ts
import { createClient } from '@supabase/supabase-js';

describe('RLS Policies', () => {
  const userA = { id: 'user-a-uuid', email: 'a@test.com' };
  const userB = { id: 'user-b-uuid', email: 'b@test.com' };

  test('user cannot read other user claims', async () => {
    // Login as userA
    const clientA = createTestClient(userA);

    // Try to read userB's claims
    const { data, error } = await clientA.from('claims').select('*').eq('user_id', userB.id);

    expect(data).toHaveLength(0); // RLS blocks access
  });

  test('user cannot delete other user documents', async () => {
    const clientA = createTestClient(userA);

    const { error } = await clientA.from('documents').delete().eq('user_id', userB.id);

    expect(error).not.toBeNull(); // Should fail
  });
});
```

#### 4. Input Validation Tests (CI)

```typescript
// src/app/api/process-resume/__tests__/validation.test.ts
import { resumeUploadSchema } from '../schema';

describe('API Input Validation', () => {
  test('rejects files over 10MB', () => {
    const result = resumeUploadSchema.safeParse({
      fileSize: 15_000_000, // 15MB
    });
    expect(result.success).toBe(false);
  });

  test('rejects non-PDF/DOCX files', () => {
    const result = resumeUploadSchema.safeParse({
      mimeType: 'application/javascript',
    });
    expect(result.success).toBe(false);
  });
});
```

### Security Enforcement Summary

| Check                  | Enforcement             | Blocks PR? |
| ---------------------- | ----------------------- | ---------- |
| Secret scanning        | gitleaks in CI          | ✅ Yes     |
| Dependency audit       | pnpm audit high         | ✅ Yes     |
| RLS tests              | Vitest in CI            | ✅ Yes     |
| Input validation tests | Vitest in CI            | ✅ Yes     |
| HTTPS                  | Vercel/Supabase default | N/A        |
| Rate limiting          | Vercel config           | N/A        |

### Post-MVP Security (Phase 7+)

- [ ] CodeQL SAST scanning
- [ ] CSP headers in next.config.js
- [ ] Penetration testing
- [ ] OWASP Top 10 review

---

## Performance

### Targets

| Metric                  | Target  | How to Measure      |
| ----------------------- | ------- | ------------------- |
| **Time to Interactive** | < 3s    | Lighthouse CI       |
| **API response (p95)**  | < 500ms | Vercel Analytics    |
| **Resume extraction**   | < 10s   | Application logs    |
| **Vector search**       | < 200ms | Supabase query logs |

### Lighthouse CI (Optional, Phase 7+)

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            https://idynic.com/
            https://idynic.com/login
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
```

```json
// lighthouse-budget.json
[
  {
    "path": "/*",
    "resourceSizes": [
      { "resourceType": "script", "budget": 300 },
      { "resourceType": "total", "budget": 1000 }
    ],
    "resourceCounts": [{ "resourceType": "third-party", "budget": 5 }]
  }
]
```

### Database Performance

- **Indexes** - Already defined in schema for common queries
- **Vector index** - IVFFlat with 100 lists (good for <100k vectors)
- **Connection pooling** - Supabase handles this automatically

---

## GitHub Workflows

### Complete CI/CD Setup

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test --coverage

      # Upload coverage (optional)
      - uses: codecov/codecov-action@v3
        if: github.event_name == 'push'
        with:
          files: ./coverage/lcov.info

  guardrails:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check file sizes
        run: |
          find src -name "*.ts" -o -name "*.tsx" | while read f; do
            lines=$(wc -l < "$f")
            if [ "$lines" -gt 300 ]; then
              echo "❌ $f has $lines lines (max 300)"
              exit 1
            fi
          done

      - name: Check component count
        run: |
          count=$(find src/components -name "*.tsx" 2>/dev/null | wc -l)
          if [ "$count" -gt 30 ]; then
            echo "❌ Too many components: $count (max 30)"
            exit 1
          fi

      - name: Check dependency count
        run: |
          count=$(jq '.dependencies | length' package.json)
          if [ "$count" -gt 30 ]; then
            echo "❌ Too many dependencies: $count (max 30)"
            exit 1
          fi

      - name: Check API route count
        run: |
          count=$(find src/app/api -name "route.ts" 2>/dev/null | wc -l)
          if [ "$count" -gt 5 ]; then
            echo "❌ Too many API routes: $count (max 5)"
            exit 1
          fi

  docs-freshness:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check CLAUDE.md updated
        run: |
          core_changed=$(git diff --name-only origin/main | grep -E "^src/lib/|^src/app/api/" | wc -l)
          claude_changed=$(git diff --name-only origin/main | grep "CLAUDE.md" | wc -l)
          if [ "$core_changed" -gt 0 ] && [ "$claude_changed" -eq 0 ]; then
            echo "⚠️ Core logic changed but CLAUDE.md wasn't updated"
            exit 1
          fi
```

### Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        patterns:
          - '*'
        update-types:
          - 'minor'
          - 'patch'
```

### Preview Deployments (Vercel handles automatically)

- Every PR gets a preview URL
- No additional workflow needed
- Configure in Vercel dashboard

---

## Non-Functionals Summary

| Category            | Requirement            | Implementation                 |
| ------------------- | ---------------------- | ------------------------------ |
| **Availability**    | 99.9% uptime           | Vercel + Supabase SLA          |
| **Performance**     | < 3s TTI, < 500ms API  | Lighthouse CI, logs            |
| **Security**        | OWASP Top 10 compliant | RLS, validation, rate limiting |
| **Scalability**     | Handle 10k users       | Supabase auto-scales           |
| **Maintainability** | < 300 line files       | CI guardrails                  |
| **Testability**     | 80% core coverage      | Vitest + CI                    |
| **Observability**   | Errors tracked         | Vercel Analytics (free tier)   |

---

## Post-MVP Roadmap

### Phase 9: Operational Maturity

| #   | Task                                     | Priority |
| --- | ---------------------------------------- | -------- |
| 9.1 | Add structured logging (pino or similar) | High     |
| 9.2 | Set up error tracking (Sentry free tier) | High     |
| 9.3 | Create production runbook                | High     |
| 9.4 | Add OpenAI cost alerts                   | High     |
| 9.5 | Implement user data export               | Medium   |
| 9.6 | Implement account deletion               | Medium   |
| 9.7 | Add audit logging for admin actions      | Medium   |
| 9.8 | Set up database migration workflow       | Medium   |

### Phase 10: Scale Prep

| #    | Task                               | Priority |
| ---- | ---------------------------------- | -------- |
| 10.1 | Add Redis caching (Upstash)        | Medium   |
| 10.2 | Implement job queue for extraction | Medium   |
| 10.3 | Add A/B testing for prompts        | Low      |
| 10.4 | CodeQL SAST scanning               | Low      |
| 10.5 | Set up staging environment         | Low      |

### Phase 11: Features (When Needed)

| #    | Task                 | Priority |
| ---- | -------------------- | -------- |
| 11.1 | Story capture        | TBD      |
| 11.2 | Gmail integration    | TBD      |
| 11.3 | Interview prep       | TBD      |
| 11.4 | Public share links   | TBD      |
| 11.5 | Kanban board         | TBD      |
| 11.6 | Browser extension    | TBD      |
| 11.7 | Multi-resume support | TBD      |

---

## Veteran's Checklist

Things a senior dev would immediately ask about. Address these before claiming "production ready."

### Error Handling Strategy

**Not in MVP, but document the approach:**

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
  }
}

// Usage
throw new AppError('Resume too large', 'RESUME_TOO_LARGE', 400);
```

**React Error Boundaries:**

```typescript
// components/ErrorBoundary.tsx
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryPrimitive
      fallback={<ErrorFallback />}
      onError={(error) => {
        // Log to Sentry (Phase 9)
        console.error('Error boundary caught:', error);
      }}
    >
      {children}
    </ErrorBoundaryPrimitive>
  );
}
```

### Logging Strategy (Phase 9)

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

// Usage
logger.info({ userId, documentId }, 'Resume extraction started');
logger.error({ userId, error: err.message }, 'Extraction failed');
```

**Log levels:**

- `error` - Something broke, needs attention
- `warn` - Unusual but handled
- `info` - Business events (upload, extraction complete)
- `debug` - Developer debugging (disabled in prod)

### Cost Guardrails

**OpenAI spend alerts:**

```typescript
// lib/ai/cost-tracking.ts
const DAILY_LIMIT_CENTS = 500; // $5/day

export async function trackCost(operation: string, inputTokens: number, outputTokens: number) {
  const costCents = calculateCost(inputTokens, outputTokens);

  // Store in Supabase
  await supabase.from('ai_costs').insert({
    operation,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_cents: costCents,
    created_at: new Date().toISOString(),
  });

  // Check daily spend
  const { data: todaySpend } = await supabase
    .from('ai_costs')
    .select('cost_cents')
    .gte('created_at', startOfDay());

  const totalCents = todaySpend?.reduce((sum, r) => sum + r.cost_cents, 0) || 0;

  if (totalCents > DAILY_LIMIT_CENTS) {
    logger.error({ totalCents }, 'DAILY AI SPEND LIMIT EXCEEDED');
    // Could: send email, disable extractions, etc.
  }
}
```

### Database Migration Workflow

```bash
# 1. Create migration
supabase migration new add_status_to_claims

# 2. Write SQL
# supabase/migrations/YYYYMMDDHHMMSS_add_status_to_claims.sql
alter table claims add column status text default 'active';

# 3. Test locally
supabase db reset  # Runs all migrations fresh

# 4. Push to production
supabase db push
```

**Rules:**

- Never modify existing migrations
- Always add default values for new columns
- Test migrations on local Supabase first

### Local Development

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-key>
OPENAI_API_KEY=sk-...

# Start local Supabase
supabase start

# Start Next.js
pnpm dev

# Full reset (wipe data)
supabase db reset
```

### Data Portability (Phase 9)

**User data export:**

```typescript
// app/api/export/route.ts
export async function GET(request: Request) {
  const userId = getUserIdFromRequest(request);

  const [profile, documents, claims, opportunities] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('documents').select('*').eq('user_id', userId),
    supabase.from('claims').select('*').eq('user_id', userId),
    supabase.from('opportunities').select('*').eq('user_id', userId),
  ]);

  return new Response(
    JSON.stringify({
      exported_at: new Date().toISOString(),
      profile: profile.data,
      documents: documents.data,
      claims: claims.data,
      opportunities: opportunities.data,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="idynic-export.json"',
      },
    }
  );
}
```

**Account deletion:**

```typescript
// app/api/account/delete/route.ts
export async function DELETE(request: Request) {
  const userId = getUserIdFromRequest(request);

  // Cascade deletes handle related data via foreign keys
  await supabase.auth.admin.deleteUser(userId);

  return new Response(null, { status: 204 });
}
```

### Production Runbook (Phase 9)

**Create `docs/runbook.md`:**

````markdown
# Production Runbook

## Common Issues

### 1. Resume extraction failing

- Check OpenAI status: https://status.openai.com
- Check Supabase status: https://status.supabase.com
- Look at Vercel logs for specific error
- If rate limited: wait or increase OpenAI tier

### 2. Users can't log in

- Check Supabase Auth status
- Verify Site URL in Supabase dashboard matches production
- Check for auth cookie issues (third-party cookie blocking)

### 3. High latency

- Check Vercel analytics for slow routes
- Check Supabase query performance
- Check if vector index needs rebuilding (rare)

## Emergency Procedures

### Take site offline

1. Vercel dashboard → Settings → Domains → Remove custom domain
2. Or: Add maintenance page at app/page.tsx

### Rollback deployment

1. Vercel dashboard → Deployments → Find last good deploy → "..." → "Promote to Production"

### Reset a user's data

```sql
-- Run in Supabase SQL editor
delete from matches where user_id = 'uuid-here';
delete from claims where user_id = 'uuid-here';
delete from opportunities where user_id = 'uuid-here';
delete from documents where user_id = 'uuid-here';
```
````

```

### Future API/MCP Integration (Not MVP, But Design For It)

Things to do NOW to avoid pain later when exposing APIs to integrations.

**1. Version your routes from day 1:**
```

src/app/api/v1/claims/route.ts ✅ Do this
src/app/api/claims/route.ts ❌ Not this

````

**2. Use response envelopes:**
```typescript
// lib/api/response.ts
export function apiResponse<T>(data: T, meta?: Record<string, unknown>) {
  return Response.json({ data, meta });
}

// Usage
return apiResponse(claims, { count: claims.length });

// Output: { "data": [...], "meta": { "count": 5 } }
````

**3. Don't expose raw UUIDs (optional but recommended):**

```typescript
// lib/api/ids.ts
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

export function publicId(prefix: string): string {
  return `${prefix}_${nanoid()}`;  // claim_abc123xyz456
}

// Store both in DB
create table claims (
  id uuid primary key,
  public_id text unique not null default 'claim_' || nanoid(),
  ...
);
```

**4. API key auth table (add to schema, don't implement):**

```sql
-- supabase/migrations/001_initial_schema.sql
-- Include but don't use yet
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  key_hash text not null,
  scopes text[] default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);
-- RLS: users can only see their own keys
alter table api_keys enable row level security;
create policy "Users can manage own API keys" on api_keys for all using (auth.uid() = user_id);
```

**5. MCP Server considerations:**
When building MCP tools later, they'll need:

- Read access to claims, opportunities, matches
- Write access to opportunities (add from external sources)
- Possibly trigger extraction (add document → process)

Keep extraction logic in `lib/ai/` not in route handlers, so MCP can reuse it.

**What NOT to do now:**

- Don't build the MCP server
- Don't implement API key auth
- Don't add rate limiting tiers
- Don't build webhook system

Just structure code so these are easy to add later.

### What We're Explicitly NOT Doing

| Thing               | Why Not                                                |
| ------------------- | ------------------------------------------------------ |
| Staging environment | Overkill for 1 user, Vercel preview deploys are enough |
| Multi-region        | Supabase/Vercel handle this, not our problem           |
| Custom auth         | Supabase Auth is battle-tested                         |
| GraphQL             | REST is fine, GraphQL adds complexity                  |
| Microservices       | Monolith is correct at this scale                      |
| Kubernetes          | Vercel serverless is simpler                           |
| Feature flags       | Direct code changes are fine with 1 user               |
| i18n                | English only for now                                   |
| Offline support     | Not a PWA, no need                                     |
| Real-time           | Polling is fine, WebSockets add complexity             |

---

## Estimated Effort

**Total: ~20-25 hours of focused work**

| Phase                  | Hours   |
| ---------------------- | ------- |
| Phase 0: Teardown      | 2       |
| Phase 1: Foundation    | 2       |
| Phase 2: Auth          | 3       |
| Phase 3: Resume Upload | 4       |
| Phase 4: Identity View | 2       |
| Phase 5: Opportunities | 4       |
| Phase 6: Matching      | 3       |
| Phase 7: Polish        | ongoing |
| Phase 8: Go Live       | 1       |

---

## Monthly Costs (After Migration)

| Item                | Cost           |
| ------------------- | -------------- |
| Supabase Pro        | $25            |
| Vercel Pro          | $20            |
| OpenAI (your usage) | $1-5           |
| **Total**           | **~$50/month** |

vs. current AWS: ~$200-500/month idle

```

```
