# Claim Evaluation Framework

**Status:** Superseded by `2025-12-28-claim-eval-framework-v2.md`

> This document has been replaced by a v2 plan created 2025-12-28. The v2 implementation is complete.

## Overview

Hybrid evaluation system to sanity-check AI-generated claims after extraction. Combines fast rule-based checks with sampled AI evaluation to catch duplicates, conflicts, hallucinations, and data quality issues.

## Goals

1. **Catch quality issues** - Duplicates, conflicts, hallucinations, malformed data
2. **Flag for review** - Surface issues to users without blocking the flow
3. **Monitor quality** - Track eval pass rates over time per model/operation
4. **Minimal latency impact** - Run in background after extraction completes

## Architecture

```
Resume Upload
     │
     ▼
┌─────────────────┐
│ Extract Resume  │  ◄── Gemini 3 Flash
│ Extract Evidence│
│ Synthesize Claims│
└────────┬────────┘
         │
         ▼
   Claims Created ──────► User sees results immediately
         │
         │ (async via Inngest)
         ▼
┌─────────────────────────────────────────┐
│           Eval Pipeline                 │
│                                         │
│  1. Rule Checks (100% of claims)        │
│     • Duplicate detection               │
│     • Date validation                   │
│     • Required fields                   │
│     • Overlapping roles                 │
│                                         │
│  2. AI Eval (sampled, 5 claims max)     │
│     • Grounded in source? (hallucination)│
│     • Accurately extracted?             │
│     • Semantic conflicts?               │
│     Model: gpt-4o-mini or claude-sonnet │
│                                         │
└────────────────┬────────────────────────┘
                 │
                 ▼
         ┌──────────────┐
         │ Eval Result  │
         │ passed: bool │
         │ issues: []   │
         └──────┬───────┘
                │
       ┌────────┴────────┐
       │                 │
       ▼                 ▼
   passed=true      passed=false
   (log only)       (flag for review)
```

## Database Schema

```sql
-- New table for eval results
create table public.claim_eval_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,

  -- What triggered this eval
  document_id uuid references public.documents(id) on delete cascade,

  -- Counts
  total_claims integer not null,
  sampled_claims integer not null,

  -- Rule check results
  rule_checks jsonb not null,  -- { duplicates: {...}, dates: {...}, ... }
  rule_passed boolean not null,

  -- AI eval results
  ai_eval_result jsonb,        -- { evaluations: [...], overall_quality: "good" }
  ai_eval_passed boolean,
  ai_eval_cost_cents integer,

  -- Overall
  passed boolean not null,
  issues jsonb,                -- Summary of all issues found

  -- Review status
  needs_review boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),

  created_at timestamptz default now() not null
);

create index claim_eval_log_user_id_idx on claim_eval_log(user_id);
create index claim_eval_log_needs_review_idx on claim_eval_log(needs_review) where needs_review = true;
```

## Rule Checks

### 1. Duplicate Detection
- Fuzzy string match on claim labels (threshold: 85% similarity)
- Exact match on claim type + company + date range
- Severity: warning

### 2. Date Validation
- End date must be after start date
- No future start dates (warning if within 30 days, error if > 30 days)
- Reasonable date ranges (no 50-year tenures)
- Severity: error/warning

### 3. Required Fields
- Claims must have: type, label
- Experience claims must have: company or description
- Education claims must have: school or description
- Severity: error

### 4. Overlapping Roles
- Same company + overlapping date ranges with different roles = warning
- Exact same company + dates + role = likely duplicate
- Severity: warning

## AI Eval

### Sampling Strategy
```typescript
function sampleClaims(claims: Claim[], config: EvalConfig): Claim[] {
  const maxSample = Math.min(
    config.sampleSize,                              // e.g., 5
    Math.ceil(claims.length * config.samplePercent) // e.g., 20%
  );

  // Stratified sampling: ensure mix of claim types
  const byType = groupBy(claims, 'type');
  const sampled: Claim[] = [];

  // Take at least 1 from each type, then fill randomly
  for (const [type, typeClaims] of Object.entries(byType)) {
    if (sampled.length < maxSample) {
      sampled.push(randomPick(typeClaims));
    }
  }

  // Fill remaining slots randomly
  const remaining = claims.filter(c => !sampled.includes(c));
  while (sampled.length < maxSample && remaining.length > 0) {
    sampled.push(remaining.splice(randomIndex(remaining), 1)[0]);
  }

  return sampled;
}
```

### Eval Prompt
```
You are evaluating AI-extracted claims against a source resume.

For each claim, determine:
1. GROUNDED: Does this information appear in the source document?
   - "yes" = clearly stated in source
   - "partial" = implied or partially matches
   - "no" = not found in source (hallucination)

2. ACCURATE: Is the extracted information correct?
   - Check dates, company names, job titles, skills match source

3. CONFLICTS: Does this claim conflict with other claims?

Source document:
"""
{source_text}
"""

Claims to evaluate:
{claims_json}

Respond with JSON only:
{
  "evaluations": [
    {
      "claim_id": "uuid",
      "grounded": "yes|partial|no",
      "accurate": true|false,
      "conflicts_with": ["uuid"] or null,
      "issue": "description if any problem" or null
    }
  ],
  "overall_quality": "good|acceptable|poor"
}
```

### Eval Thresholds
- **Pass**: All sampled claims grounded=yes|partial, accurate=true
- **Warn**: Any grounded=partial or minor issues
- **Fail**: Any grounded=no (hallucination) or accurate=false

## Inngest Integration

```typescript
// New function: evaluate-claims
export const evaluateClaims = inngest.createFunction(
  { id: 'evaluate-claims', name: 'Evaluate extracted claims' },
  { event: 'claims/extracted' },
  async ({ event, step }) => {
    const { userId, documentId, claims, sourceText } = event.data;

    // Step 1: Rule checks (all claims)
    const ruleResults = await step.run('rule-checks', async () => {
      return runRuleChecks(claims);
    });

    // Step 2: AI eval (sampled)
    const aiResult = await step.run('ai-eval', async () => {
      const sampled = sampleClaims(claims, EVAL_CONFIG);
      return runAIEval(sampled, sourceText);
    });

    // Step 3: Log results
    const evalResult = await step.run('log-eval', async () => {
      const passed = ruleResults.passed && aiResult.passed;

      await logEvalResult({
        userId,
        documentId,
        totalClaims: claims.length,
        sampledClaims: aiResult.sampleSize,
        ruleChecks: ruleResults,
        aiEvalResult: aiResult,
        passed,
        needsReview: !passed,
      });

      return { passed, issues: [...ruleResults.issues, ...aiResult.issues] };
    });

    // Step 4: Notify if issues found
    if (!evalResult.passed) {
      await step.run('flag-for-review', async () => {
        // Could trigger notification, set flag in UI, etc.
        await flagDocumentForReview(documentId, evalResult.issues);
      });
    }

    return evalResult;
  }
);
```

### Trigger Point

In `process-resume.ts`, after claims are synthesized:

```typescript
// After synthesize step completes
await step.sendEvent('trigger-eval', {
  name: 'claims/extracted',
  data: {
    userId,
    documentId,
    claims: synthesizedClaims,
    sourceText: resumeText,
  },
});
```

## User Experience

### Flag Display
- Badge on document card: "Review needed"
- Expandable panel showing issues found
- Issues grouped by severity (errors first, then warnings)

### Review Actions
- "Dismiss" - Mark as reviewed, no action needed
- "Edit claim" - Jump to claim editor
- "Delete claim" - Remove problematic claim
- After review, `reviewed_at` and `reviewed_by` are set

## Configuration

```typescript
// src/lib/ai/eval-config.ts
export const CLAIM_EVAL_CONFIG: EvalConfig = {
  rules: {
    duplicates: { enabled: true, threshold: 0.85 },
    dates: { enabled: true, allowFutureDays: 30 },
    requiredFields: { enabled: true },
    overlappingRoles: { enabled: true },
  },
  aiEval: {
    enabled: true,
    sampleSize: 5,
    samplePercent: 0.2,
    model: {
      provider: process.env.EVAL_PROVIDER || 'openai',
      model: process.env.EVAL_MODEL || 'gpt-4o-mini',
    },
  },
};
```

### Model Options for AI Eval

Using a **different model** from the generator provides diversity and catches blind spots:

| Model | Cost per Eval | Use Case |
|-------|---------------|----------|
| `gpt-4o-mini` | ~$0.001 | Default, cheap, good for routine checks |
| `claude-sonnet-4-5-20250514` | ~$0.014 | "Second opinion", different training/biases |
| `claude-opus-4-5-20250514` | ~$0.023 | Higher quality, for debugging/spot-checks |

**Recommended setup:**
- Default: `gpt-4o-mini` (runs every time)
- Optional: Random 10% of evals use `claude-sonnet-4-5` for diversity

```typescript
// Random model diversity (optional)
const useClaudeForDiversity = Math.random() < 0.1; // 10% of evals
const evalModel = useClaudeForDiversity
  ? { provider: 'anthropic', model: 'claude-sonnet-4-5-20250514' }
  : { provider: 'openai', model: 'gpt-4o-mini' };
```

## Cost Analysis

| Component | Per Resume | Notes |
|-----------|------------|-------|
| Rule checks | $0 | Local computation |
| AI eval (gpt-4o-mini) | ~$0.001 | ~2K input, 500 output tokens |
| AI eval (claude-sonnet-4-5) | ~$0.014 | Same tokens, higher per-token cost |
| **Default total** | **~$0.001** | <1% of extraction cost |
| **With 10% Claude diversity** | **~$0.002** | Blended average |

## Implementation Steps

### Phase 1: Infrastructure
1. Create `claim_eval_log` migration
2. Add `src/lib/ai/eval/types.ts` - interfaces
3. Add `src/lib/ai/eval/config.ts` - configuration
4. Regenerate Supabase types

### Phase 2: Rule Checks
5. Add `src/lib/ai/eval/rules/duplicates.ts`
6. Add `src/lib/ai/eval/rules/dates.ts`
7. Add `src/lib/ai/eval/rules/required-fields.ts`
8. Add `src/lib/ai/eval/rules/overlapping-roles.ts`
9. Add `src/lib/ai/eval/rule-runner.ts` - orchestrates all rules

### Phase 3: AI Eval
10. Add `src/lib/ai/eval/ai-eval.ts` - sampling + prompt
11. Add eval operation to gateway config

### Phase 4: Integration
12. Add `src/inngest/functions/evaluate-claims.ts`
13. Update `process-resume.ts` to trigger eval event
14. Add `needs_review` column to documents table (or use eval_log)

### Phase 5: UI (future)
15. Add review badge to document cards
16. Add issues panel component
17. Add review actions

## Prerequisites (Already Complete)

The AI gateway now supports all three providers:
- OpenAI (`src/lib/ai/providers/openai.ts`)
- Google Gemini (`src/lib/ai/providers/google.ts`)
- Anthropic Claude (`src/lib/ai/providers/anthropic.ts`)

Pricing configured in `src/lib/ai/pricing.ts` for:
- `gpt-4o-mini`: $0.15/$0.60 per MTok
- `claude-sonnet-4-5-20250514`: $3.00/$15.00 per MTok
- `claude-opus-4-5-20250514`: $5.00/$25.00 per MTok

---

# Part 2: Tailoring Eval Framework

## Overview

Post-tailoring evaluation to ensure generated profiles are truthful and don't miss opportunities. Runs after a tailored profile is generated for a job opportunity.

**Core rule: We can't lie.**

## What We Check

| Check | What it catches | Severity |
|-------|-----------------|----------|
| **Grounding** | Output claims something user doesn't have | ❌ Fail |
| **Utilization** | User has relevant skill but output missed it | ⚠️ Warning |
| **Gap awareness** | Job requires X, user lacks X | ℹ️ Info only |

## Scenarios

| Scenario | Eval Result |
|----------|-------------|
| Job requires AWS, user has AWS, output mentions it | ✅ Good |
| Job requires AWS, user has AWS, output **doesn't** mention it | ⚠️ Missed opportunity (flag) |
| Job requires AWS, user **doesn't** have AWS, output says nothing | ✅ Fine (surface as info) |
| Job requires AWS, user **doesn't** have AWS, output **claims they have it** | ❌ Hallucination (fail) |

## Source of Truth

- **User's claims** (not raw resume text)
- Claims are already validated/structured data
- If it's not in claims, user doesn't have it

## AI Eval Prompt

```
You are evaluating a tailored job profile for truthfulness.

User's verified claims (source of truth):
{claims_json}

Job posting requirements:
{job_requirements}

Generated tailored profile:
{tailored_profile}

Evaluate:

1. GROUNDING: Does every skill, experience, or qualification mentioned in the
   tailored profile exist in the user's claims? Flag any hallucinations.

2. UTILIZATION: Are there relevant claims that match job requirements but
   weren't highlighted in the profile? Flag missed opportunities.

3. GAPS: What key job requirements does the user lack? (Informational only,
   not a failure - users can still apply)

Respond with JSON:
{
  "grounding": {
    "passed": true|false,
    "hallucinations": [
      { "claim": "what output said", "issue": "not found in user claims" }
    ]
  },
  "utilization": {
    "passed": true|false,
    "missed": [
      { "requirement": "AWS experience", "matching_claim": "claim user has" }
    ]
  },
  "gaps": [
    { "requirement": "5+ years Python", "note": "User has 3 years" }
  ],
  "overall": "good|acceptable|poor"
}
```

## Thresholds

- **Fail**: Any hallucination (grounding.passed = false)
- **Warning**: Missed utilization opportunities
- **Info**: Gaps surfaced to user (not a failure)

## Action on Failure

Same as claims eval: **Flag for review**

User sees:
> "Review needed: The generated profile may contain inaccuracies."

With expandable details showing the specific issues.

## Informational Gap Surfacing (UX, not eval)

When gaps are detected, surface to user:

> "This role asks for AWS experience. Your profile doesn't include this -
> consider adding if you have relevant experience, or be prepared to
> address in the interview."

This is helpful context, not a blocker.

## Integration

Trigger after `tailor-profile` completes:

```typescript
await step.sendEvent('trigger-tailoring-eval', {
  name: 'tailoring/completed',
  data: {
    userId,
    opportunityId,
    claims: userClaims,
    jobRequirements: extractedRequirements,
    tailoredProfile: generatedProfile,
  },
});
```

## Implementation Steps

### Phase 1: Core Eval
1. Add `tailoring_eval_log` table (or reuse `claim_eval_log` with type field)
2. Add `src/lib/ai/eval/tailoring-eval.ts`
3. Add Inngest function `evaluate-tailoring.ts`

### Phase 2: Integration
4. Update tailoring flow to trigger eval
5. Add flag to opportunity when eval fails

### Phase 3: UX
6. Show "Review needed" badge on opportunity
7. Surface gap information to user

---

## Future Extensions

- **A/B model comparison**: Run same claims through multiple models, compare
- **Adaptive sampling**: Increase sample size if quality drops
- **Auto-remediation**: Automatically merge obvious duplicates
- **Cross-model consensus**: Run eval on both GPT and Claude, flag disagreements
