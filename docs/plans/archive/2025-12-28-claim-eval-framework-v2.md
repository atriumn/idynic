# Claim & Tailoring Eval Framework v2

> Updated 2025-12-28 after brainstorming session. Replaces 2025-12-27-claim-eval-framework.md.

## Overview

Two eval systems that catch quality issues before users see or share content:

1. **Claim Eval** - Runs as part of resume/story processing. Validates claims against their evidence.
2. **Tailoring Eval** - Runs during profile generation. Catches hallucinations before user shares.

Both are **sync** - user sees results with issues already flagged.

## Architecture

```
Resume/Story Upload Flow:
┌─────────────────────────────────────────────────────────────────┐
│                     process-resume (Inngest)                    │
│                                                                 │
│  parse → extract → embed → synthesize → reflect → EVAL CLAIMS  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Modal closes, user sees claims
                    with issues already flagged

Tailoring Flow:
┌─────────────────────────────────────────────────────────────────┐
│                     POST /tailor (sync API)                     │
│                                                                 │
│         generate profile → EVAL GROUNDING → return              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    User sees profile with warning
                    if hallucinations detected
```

## Model Strategy

- **Extraction/Synthesis**: OpenAI (gpt-4o-mini) or Google (Gemini)
- **Evals**: Anthropic (Claude Sonnet) - different model family catches different blind spots

Config-driven via environment variables (same pattern as existing operations).

## Database Schema

```sql
-- Issues linked to specific claims
create table public.claim_issues (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.identity_claims(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete cascade,

  issue_type text not null check (issue_type in ('duplicate', 'missing_field', 'not_grounded', 'other')),
  severity text not null check (severity in ('error', 'warning')) default 'warning',
  message text not null,

  -- For duplicates: which claim is this a duplicate of
  related_claim_id uuid references public.identity_claims(id) on delete set null,

  -- Dismissed by user
  dismissed_at timestamptz,

  created_at timestamptz default now() not null
);

create index claim_issues_claim_id_idx on claim_issues(claim_id);
create index claim_issues_active_idx on claim_issues(claim_id) where dismissed_at is null;

-- Tailoring eval results
create table public.tailoring_eval_log (
  id uuid primary key default gen_random_uuid(),
  tailored_profile_id uuid references public.tailored_profiles(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,

  -- Results
  passed boolean not null,
  grounding_passed boolean not null,

  -- Details
  hallucinations jsonb default '[]',  -- [{text, issue}]
  missed_opportunities jsonb default '[]',  -- [{requirement, matching_claim}]
  gaps jsonb default '[]',  -- [{requirement, note}]

  -- Cost tracking
  eval_model text not null,
  eval_cost_cents integer default 0,

  created_at timestamptz default now() not null
);

create index tailoring_eval_log_profile_idx on tailoring_eval_log(tailored_profile_id);
```

## AI Gateway Configuration

```typescript
// src/lib/ai/config.ts

type ProviderType = "openai" | "google" | "anthropic";  // add anthropic

// Add to switch statement:
case "claim_eval":
  return {
    provider: getEnvProvider("CLAIM_EVAL_PROVIDER", "anthropic"),
    model: getEnvString("CLAIM_EVAL_MODEL", "claude-sonnet-4-20250514"),
  };

case "tailoring_eval":
  return {
    provider: getEnvProvider("TAILORING_EVAL_PROVIDER", "anthropic"),
    model: getEnvString("TAILORING_EVAL_MODEL", "claude-sonnet-4-20250514"),
  };
```

## Claim Eval

### Rule Checks (MVP)

Run on 100% of claims, no AI cost:

| Rule | What it catches | Status |
|------|-----------------|--------|
| **Duplicate detection** | Fuzzy match on labels (85% similarity) | MVP |
| **Required fields** | Claims missing type or label | MVP |
| Date validation | End before start, future dates | Future |
| Overlapping roles | Same company + overlapping dates | Future |

### AI Grounding Check

Samples up to 5 claims. Asks Claude: "Does this claim accurately represent its evidence?"

**What we check:** Evidence → Claim grounding (not resume → claim). Claims are synthesized from evidence, so we verify that step.

```typescript
const CLAIM_EVAL_PROMPT = `You are evaluating whether identity claims accurately represent their supporting evidence.

For each claim, determine if the claim's label and description are justified by the evidence provided.

Claims to evaluate:
{claims_json}

Each claim includes:
- label: the claim name (e.g., "React Development")
- description: what the user claims
- evidence: array of supporting evidence texts

For each claim, respond:
- "grounded": true if evidence supports the claim
- "grounded": false if claim overstates, misrepresents, or isn't supported by evidence
- "issue": explanation if not grounded (null otherwise)

Respond with JSON only:
{
  "evaluations": [
    { "claim_id": "uuid", "grounded": true, "issue": null },
    { "claim_id": "uuid", "grounded": false, "issue": "Claim says 'expert' but evidence only shows basic usage" }
  ]
}`;
```

### Integration

Added as step in `process-resume.ts` and `process-story.ts`:

```typescript
await step.run("evaluate-claims", async () => {
  await job.setPhase("evaluating");

  const { data: claims } = await supabase
    .from("identity_claims")
    .select("id, type, label, description, claim_evidence(evidence_id, strength, evidence:evidence_id(text))")
    .eq("user_id", userId);

  if (!claims || claims.length === 0) return;

  const ruleIssues = runRuleChecks(claims);
  const sampled = sampleClaims(claims, 5);
  const aiIssues = await runClaimGroundingEval(sampled);

  const allIssues = [...ruleIssues, ...aiIssues];
  if (allIssues.length > 0) {
    await supabase.from("claim_issues").insert(
      allIssues.map(issue => ({
        claim_id: issue.claimId,
        document_id: document.id,
        issue_type: issue.type,
        severity: issue.severity,
        message: issue.message,
        related_claim_id: issue.relatedClaimId,
      }))
    );
  }
});
```

## Tailoring Eval

### What We Check

| Check | Failure? | Rationale |
|-------|----------|-----------|
| **Grounding: hallucination found** | Yes | Core integrity - we can't lie |
| **Utilization: missed relevant claim** | No (info only) | Suboptimal but not wrong |
| **Gaps: user lacks requirement** | No (info only) | Expected, user can still apply |

### AI Prompt

```typescript
const TAILORING_EVAL_PROMPT = `You are evaluating a tailored job profile for truthfulness.

The user's verified claims (source of truth):
{claims_json}

The generated profile content:
{profile_content}

Check every skill, experience, or qualification mentioned in the profile.
Flag as hallucination if it's NOT supported by the user's claims.

Also identify:
- Missed opportunities: relevant claims that match job requirements but weren't highlighted
- Gaps: job requirements the user doesn't have (informational only)

Respond with JSON:
{
  "grounding": {
    "passed": true|false,
    "hallucinations": [
      { "text": "what the profile claimed", "issue": "not found in user claims" }
    ]
  },
  "utilization": {
    "missed": [
      { "requirement": "AWS experience", "matching_claim": "Cloud Infrastructure Management" }
    ]
  },
  "gaps": [
    { "requirement": "5+ years Python", "note": "User has 3 years" }
  ]
}`;
```

### Integration

Added to tailor API route, sync before returning:

```typescript
const result = await generateProfileWithClient(supabase, id, userId, regenerate);

const evalResult = await evaluateTailoredProfile({
  tailoredProfileId: result.profile.id,
  userId,
  narrative: result.profile.narrative,
  resumeData: result.profile.resume_data,
  userClaims: await getUserClaims(supabase, userId),
  jobRequirements: opportunity.requirements,
});

await supabase.from("tailoring_eval_log").insert({
  tailored_profile_id: result.profile.id,
  user_id: userId,
  passed: evalResult.passed,
  grounding_passed: evalResult.grounding.passed,
  hallucinations: evalResult.grounding.hallucinations,
  missed_opportunities: evalResult.utilization.missed,
  gaps: evalResult.gaps,
  eval_model: evalResult.model,
  eval_cost_cents: evalResult.costCents,
});

return apiSuccess({
  // ... existing fields ...
  eval: {
    passed: evalResult.passed,
    warnings: evalResult.grounding.hallucinations.length > 0
      ? "This profile may contain inaccuracies"
      : null,
    gaps: evalResult.gaps,
  },
});
```

## Claim Management API

Users need to act on flagged claims:

```typescript
// PATCH /api/v1/claims/[id] - Edit claim
// Clears issues after edit (trust the user's fix)

// DELETE /api/v1/claims/[id] - Remove claim
// Issues cascade via FK

// POST /api/v1/claims/[id]/dismiss - Dismiss issues
// Sets dismissed_at, warning icon disappears
```

Merge duplicates deferred to future.

## UI Changes

### Claims List (`/identity`)

- Warning icon next to claims with active issues
- Expandable issue banner showing message + actions
- Actions: Dismiss, Edit, Delete
- Filter toggle: "Show issues only"

```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️ React Development                                    [Skill] │
│    "Expert-level React and component architecture"              │
│                                                                 │
│    Issue: Claim says "expert" but evidence shows basic usage    │
│                                                                 │
│    [Dismiss]  [Edit]  [Delete]                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Tailored Profile (`/opportunities/[id]`)

Warning banner above profile tabs if hallucinations detected:

```
⚠️ This profile may contain inaccuracies. Review before sharing.
```

## Implementation Steps

### Phase 1: Infrastructure
1. Create `claim_issues` migration
2. Create `tailoring_eval_log` migration
3. Add `anthropic` to provider type in `config.ts`
4. Add `claim_eval` and `tailoring_eval` operations to `config.ts`
5. Regenerate Supabase types

### Phase 2: Eval Logic
6. Create `src/lib/ai/eval/rule-checks.ts` (duplicates, required fields)
7. Create `src/lib/ai/eval/claim-grounding.ts` (AI eval)
8. Create `src/lib/ai/eval/tailoring-grounding.ts` (AI eval)

### Phase 3: Integration
9. Add eval step to `process-resume.ts`
10. Add eval step to `process-story.ts`
11. Add eval to tailor API route

### Phase 4: Claim Management API
12. Create `PATCH /api/v1/claims/[id]`
13. Create `DELETE /api/v1/claims/[id]`
14. Create `POST /api/v1/claims/[id]/dismiss`

### Phase 5: UI
15. Update claims list query to include issues
16. Add issue banner with dismiss/edit/delete actions
17. Add "Show issues only" filter toggle
18. Add edit claim modal
19. Add warning banner to tailored profile

## Cost Analysis

| Component | Per Resume | Notes |
|-----------|------------|-------|
| Rule checks | $0 | Local computation |
| Claim eval (claude-sonnet) | ~$0.01 | ~2K input, 500 output tokens |
| Tailoring eval (claude-sonnet) | ~$0.02 | Larger input (claims + profile) |

Negligible compared to extraction costs.

## Decisions Made

1. Both evals built together (shared infrastructure)
2. Config-driven models via env vars (Claude for evals)
3. Failures flag only, don't block user
4. Tailoring eval is sync (user waits, sees warning immediately)
5. Claim eval is sync (part of resume processing pipeline)
6. Two tables (claim_issues, tailoring_eval_log)
7. Evidence → Claim grounding (not resume → claim)
8. Only hallucinations fail tailoring; utilization/gaps are info
9. Claim edit clears issues (trust user's fix)
10. Rule checks MVP: duplicates + required fields only

## Implementation Decisions (from clarification)

11. **Anthropic client**: Follow existing AI gateway pattern (see OpenAI/Google implementations)
12. **Claim sampling**: Prioritize newer claims and claims with thin evidence (fewer evidence items)
13. **Duplicate detection**: Jaro-Winkler similarity, case-insensitive, labels only for MVP
14. **AI eval failures**: Flag claims as "unevaluated" with warning severity (don't block processing)
15. **Eval step placement**: After `reflect-identity`, before `complete-job` in process-resume/story
16. **UI patterns**: Follow existing Tailwind + shadcn/ui component patterns
17. **Testing**: Unit tests for rule checks and eval logic; integration tests deferred
