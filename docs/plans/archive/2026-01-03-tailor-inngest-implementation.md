# Tailor Inngest Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate tailoring profile generation from synchronous to async Inngest-based processing.

**Architecture:** Add `tailor/process` event to Inngest, create `processTailor` function that handles generation and evaluation. API endpoints return job_id for async flow, cached profiles return immediately.

**Tech Stack:** Inngest, Supabase, Next.js API routes, TypeScript

**Status:** Done

## Progress (Last reviewed: 2026-01-03)

| Step | Status | Notes |
|------|--------|-------|
| Task 1: Database Migration | ✅ Complete | PR #100 - `20260103000000_tailor_job_type.sql` |
| Task 2: Add Inngest Event Type | ✅ Complete | PR #100 - `tailor/process` event added |
| Task 3: Add Ticker Messages for Tailor Phases | ✅ Complete | PR #100 - analyzing/generating/evaluating phases |
| Task 4: Create Process Tailor Inngest Function | ✅ Complete | PR #100 - `process-tailor.ts` with 8 steps |
| Task 5: Export Process Tailor Function | ✅ Complete | PR #100 - exported in `inngest/index.ts` |
| Task 6: Refactor Tailor Endpoint | ✅ Complete | PR #100 - async with cached profile bypass |
| Task 7: Refactor Add-and-Tailor Endpoint | ✅ Complete | PR #100 - returns job_id |
| Task 8: Refactor Add-Tailor-Share Endpoint | ✅ Complete | PR #100 - returns job_id |
| Task 9: Update Tests | ✅ Complete | PR #100 - tests updated for async pattern |
| Task 10: Run Tests and Verify | ✅ Complete | PR #100 merged 2026-01-03 |

### Drift Notes
None - implementation followed the plan exactly.

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDD_tailor_job_type.sql`

**Step 1: Create migration file**

```sql
-- Add 'tailor' to the document_jobs job_type constraint
ALTER TABLE document_jobs
DROP CONSTRAINT IF EXISTS document_jobs_job_type_check;

ALTER TABLE document_jobs
ADD CONSTRAINT document_jobs_job_type_check
CHECK (job_type IN ('resume', 'story', 'opportunity', 'tailor'));

-- Add tailor-specific phases
ALTER TABLE document_jobs
DROP CONSTRAINT IF EXISTS document_jobs_phase_check;

ALTER TABLE document_jobs
ADD CONSTRAINT document_jobs_phase_check
CHECK (phase IN (
  'validating', 'parsing', 'extracting', 'embeddings', 'synthesis', 'reflection',
  'enriching', 'researching',
  'analyzing', 'generating', 'evaluating'
));

-- Add tailored_profile_id column to link tailor jobs to profiles
ALTER TABLE document_jobs
ADD COLUMN IF NOT EXISTS tailored_profile_id UUID REFERENCES tailored_profiles(id) ON DELETE SET NULL;
```

**Step 2: Apply migration locally**

Run: `pnpm supabase db reset` or apply via Supabase dashboard

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add tailor job type and phases to document_jobs"
```

---

## Task 2: Add Inngest Event Type

**Files:**
- Modify: `apps/web/src/inngest/client.ts`

**Step 1: Add tailor/process event type**

Add to the `Events` type after line 35:

```typescript
  "tailor/process": {
    data: {
      jobId: string;
      userId: string;
      opportunityId: string;
      regenerate: boolean;
    };
  };
```

**Step 2: Commit**

```bash
git add apps/web/src/inngest/client.ts
git commit -m "feat(inngest): add tailor/process event type"
```

---

## Task 3: Add Ticker Messages for Tailor Phases

**Files:**
- Modify: `packages/shared/src/types/jobs.ts`

**Step 1: Find TICKER_MESSAGES and add tailor phases**

Add these phase messages:

```typescript
  analyzing: [
    "Analyzing opportunity requirements...",
    "Matching your experience to the role...",
    "Identifying key talking points...",
    "Finding relevant achievements...",
  ],
  generating: [
    "Crafting your narrative...",
    "Tailoring your experience...",
    "Highlighting relevant skills...",
    "Optimizing for this role...",
  ],
  evaluating: [
    "Running quality checks...",
    "Verifying claims are grounded...",
    "Checking for completeness...",
    "Finalizing your profile...",
  ],
```

**Step 2: Add phases to DocumentJobPhase type**

```typescript
export type DocumentJobPhase =
  | 'validating'
  | 'parsing'
  | 'extracting'
  | 'embeddings'
  | 'synthesis'
  | 'reflection'
  | 'enriching'
  | 'researching'
  | 'analyzing'
  | 'generating'
  | 'evaluating';
```

**Step 3: Commit**

```bash
git add packages/shared/src/types/jobs.ts
git commit -m "feat(shared): add tailor phases and ticker messages"
```

---

## Task 4: Create Process Tailor Inngest Function

**Files:**
- Create: `apps/web/src/inngest/functions/process-tailor.ts`

**Step 1: Create the function file**

```typescript
import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateTalkingPoints } from "@/lib/ai/generate-talking-points";
import { generateNarrative } from "@/lib/ai/generate-narrative";
import { generateResume } from "@/lib/ai/generate-resume";
import { evaluateTailoredProfile, getUserClaimsForEval } from "@/lib/ai/eval";
import { incrementTailoredProfileCount } from "@/lib/billing/check-usage";
import { createLogger } from "@/lib/logger";
import { JobUpdater } from "@/lib/jobs/job-updater";
import type { Json, TablesInsert } from "@/lib/supabase/types";

export const processTailor = inngest.createFunction(
  {
    id: "process-tailor",
    retries: 2,
    onFailure: async ({ event, error }) => {
      const supabase = createServiceRoleClient();
      const { jobId } = event.data.event.data;
      const errorMessage = error?.message || "Unknown error occurred";

      await supabase
        .from("document_jobs")
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.error("[process-tailor] Job failed after retries:", { jobId, error: errorMessage });

      const { log } = await import("@/lib/logger");
      await log.flush();
    },
  },
  { event: "tailor/process" },
  async ({ event, step }) => {
    const { jobId, userId, opportunityId, regenerate } = event.data;
    const supabase = createServiceRoleClient();
    const jobLog = createLogger({ jobId, userId, opportunityId, inngest: true });
    const job = new JobUpdater(supabase, jobId);

    // Step 1: Validate and fetch opportunity
    const opportunity = await step.run("validate-opportunity", async () => {
      await job.setPhase("analyzing");
      jobLog.info("Starting tailor job");

      const { data: opp, error } = await supabase
        .from("opportunities")
        .select("id, title, company")
        .eq("id", opportunityId)
        .eq("user_id", userId)
        .single();

      if (error || !opp) {
        throw new Error("Opportunity not found");
      }

      await job.addHighlight(`Tailoring for ${opp.title}`, "found");
      if (opp.company) {
        await job.addHighlight(`at ${opp.company}`, "found");
      }

      return opp;
    });

    // Step 2: Delete existing profile if regenerating
    if (regenerate) {
      await step.run("delete-existing", async () => {
        jobLog.info("Regenerating - deleting existing profile");
        await supabase
          .from("tailored_profiles")
          .delete()
          .eq("user_id", userId)
          .eq("opportunity_id", opportunityId);
      });
    }

    // Step 3: Generate talking points
    const talkingPoints = await step.run("generate-talking-points", async () => {
      await job.addHighlight("Analyzing your experience...", "found");
      jobLog.info("Generating talking points");

      const points = await generateTalkingPoints(opportunityId, userId, supabase);

      await job.addHighlight(`Found ${points.length} talking points`, "found");
      return points;
    });

    // Step 4: Generate narrative
    const narrative = await step.run("generate-narrative", async () => {
      await job.setPhase("generating");
      await job.addHighlight("Crafting your narrative...", "found");
      jobLog.info("Generating narrative");

      return await generateNarrative(
        talkingPoints,
        opportunity.title,
        opportunity.company
      );
    });

    // Step 5: Generate resume
    const resumeData = await step.run("generate-resume", async () => {
      await job.addHighlight("Building tailored resume...", "found");
      jobLog.info("Generating resume data");

      return await generateResume(userId, opportunityId, talkingPoints, supabase);
    });

    // Step 6: Store profile
    const profile = await step.run("store-profile", async () => {
      jobLog.info("Storing tailored profile");

      const { data, error } = await supabase
        .from("tailored_profiles")
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

      if (error || !data) {
        throw new Error(`Failed to save profile: ${error?.message}`);
      }

      return data;
    });

    // Step 7: Run evaluation
    await step.run("evaluate-profile", async () => {
      await job.setPhase("evaluating");
      await job.addHighlight("Running quality checks...", "found");
      jobLog.info("Running evaluation");

      try {
        const userClaims = await getUserClaimsForEval(supabase, userId);
        const evaluation = await evaluateTailoredProfile({
          tailoredProfileId: profile.id,
          userId,
          narrative: profile.narrative || "",
          resumeData: profile.resume_data,
          userClaims,
        });

        const evalLogEntry: TablesInsert<"tailoring_eval_log"> = {
          tailored_profile_id: profile.id,
          user_id: userId,
          passed: evaluation.passed,
          grounding_passed: evaluation.grounding.passed,
          hallucinations: evaluation.grounding.hallucinations as unknown as Json,
          missed_opportunities: evaluation.utilization.missed as unknown as Json,
          gaps: evaluation.gaps as unknown as Json,
          eval_model: evaluation.model,
          eval_cost_cents: evaluation.costCents,
        };
        await supabase.from("tailoring_eval_log").insert(evalLogEntry);

        if (evaluation.passed) {
          await job.addHighlight("Quality checks passed!", "found");
        } else {
          await job.addHighlight("Review suggested - see details", "found");
        }

        jobLog.info("Evaluation complete", { passed: evaluation.passed });
      } catch (evalErr) {
        jobLog.error("Evaluation failed", { error: evalErr instanceof Error ? evalErr.message : String(evalErr) });
        // Don't fail the job - evaluation is optional
      }
    });

    // Step 8: Increment usage and complete
    await step.run("complete-job", async () => {
      await incrementTailoredProfileCount(supabase, userId);

      await supabase
        .from("document_jobs")
        .update({
          status: "completed",
          tailored_profile_id: profile.id,
          summary: {
            profileId: profile.id,
            opportunityId: opportunity.id,
            title: opportunity.title,
            company: opportunity.company,
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      jobLog.info("Job completed successfully");
    });

    const { log } = await import("@/lib/logger");
    await log.flush();

    return {
      status: "completed",
      profileId: profile.id,
      opportunityId: opportunity.id,
    };
  }
);
```

**Step 2: Commit**

```bash
git add apps/web/src/inngest/functions/process-tailor.ts
git commit -m "feat(inngest): add process-tailor function"
```

---

## Task 5: Export Process Tailor Function

**Files:**
- Modify: `apps/web/src/inngest/index.ts`

**Step 1: Add import and export**

Add import at top:
```typescript
import { processTailor } from "./functions/process-tailor";
```

Add to functions array:
```typescript
export const functions = [
  processResume,
  processStory,
  processOpportunity,
  researchCompanyFunction,
  processTailor,
];
```

**Step 2: Commit**

```bash
git add apps/web/src/inngest/index.ts
git commit -m "feat(inngest): export processTailor function"
```

---

## Task 6: Refactor Tailor Endpoint

**Files:**
- Modify: `apps/web/src/app/api/v1/opportunities/[id]/tailor/route.ts`

**Step 1: Rewrite the POST handler**

```typescript
import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors, apiError } from '@/lib/api/response';
import { checkTailoredProfileLimit } from '@/lib/billing/check-usage';
import { inngest } from '@/inngest';

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
    .eq('id', opportunityId)
    .eq('user_id', userId)
    .single();

  if (error || !opportunity) {
    return ApiErrors.notFound('Opportunity');
  }

  // Check for cached profile (unless regenerating)
  if (!regenerate) {
    const { data: existingProfile } = await supabase
      .from('tailored_profiles')
      .select('id, narrative, resume_data, created_at')
      .eq('opportunity_id', opportunityId)
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      // Return cached profile immediately (sync)
      return apiSuccess({
        id: existingProfile.id,
        opportunity: {
          id: opportunity.id,
          title: opportunity.title,
          company: opportunity.company,
        },
        narrative: existingProfile.narrative,
        resume_data: existingProfile.resume_data,
        cached: true,
        created_at: existingProfile.created_at,
      });
    }
  }

  // Check billing limit before creating job
  const usageCheck = await checkTailoredProfileLimit(supabase, userId);
  if (!usageCheck.allowed) {
    return apiError(
      'limit_reached',
      usageCheck.reason || 'Tailored profile limit reached',
      403,
    );
  }

  // Create job record
  const { data: job, error: jobError } = await supabase
    .from('document_jobs')
    .insert({
      user_id: userId,
      job_type: 'tailor',
      opportunity_id: opportunityId,
      status: 'pending',
    })
    .select()
    .single();

  if (jobError || !job) {
    console.error('[tailor] Job creation error:', jobError);
    return apiError('server_error', 'Failed to create processing job', 500);
  }

  // Trigger Inngest for async processing
  await inngest.send({
    name: 'tailor/process',
    data: {
      jobId: job.id,
      userId,
      opportunityId,
      regenerate,
    },
  });

  console.log('[tailor] Job created and Inngest triggered:', job.id);

  // Return job ID for polling (async)
  return apiSuccess({
    job_id: job.id,
    status: 'processing',
    message: 'Tailoring in progress',
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/api/v1/opportunities/[id]/tailor/route.ts
git commit -m "feat(api): refactor tailor endpoint to async Inngest pattern"
```

---

## Task 7: Refactor Add-and-Tailor Endpoint

**Files:**
- Modify: `apps/web/src/app/api/v1/opportunities/add-and-tailor/route.ts`

**Step 1: Read current implementation**

First read the file to understand current structure.

**Step 2: Update to return job_id after opportunity creation**

The endpoint should:
1. Create the opportunity (existing logic)
2. Create a document_job for tailoring
3. Trigger tailor/process event
4. Return { opportunity_id, job_id, status: 'processing' }

**Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/opportunities/add-and-tailor/route.ts
git commit -m "feat(api): refactor add-and-tailor to async pattern"
```

---

## Task 8: Refactor Add-Tailor-Share Endpoint

**Files:**
- Modify: `apps/web/src/app/api/v1/opportunities/add-tailor-share/route.ts`

**Step 1: Read current implementation**

First read the file to understand current structure.

**Step 2: Update to return job_id**

The endpoint should:
1. Create the opportunity
2. Create a document_job for tailoring
3. Trigger tailor/process event
4. Return { opportunity_id, job_id, status: 'processing' }

Note: Share link creation moves to after job completion (client-side or separate endpoint).

**Step 3: Commit**

```bash
git add apps/web/src/app/api/v1/opportunities/add-tailor-share/route.ts
git commit -m "feat(api): refactor add-tailor-share to async pattern"
```

---

## Task 9: Update Tests

**Files:**
- Modify: `apps/web/src/__tests__/app/api/v1/opportunities/tailor.test.ts`

**Step 1: Update test expectations**

Tests should now expect:
- Cached profiles return full profile (sync)
- New profiles return { job_id, status: 'processing' }

**Step 2: Mock Inngest send**

```typescript
vi.mock('@/inngest', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));
```

**Step 3: Commit**

```bash
git add apps/web/src/__tests__/
git commit -m "test: update tailor endpoint tests for async pattern"
```

---

## Task 10: Run Tests and Verify

**Step 1: Run all tests**

```bash
cd apps/web && pnpm test:run
```

**Step 2: Start Inngest dev server**

```bash
pnpm inngest:dev
```

**Step 3: Manual testing**

1. Call tailor endpoint with new opportunity → should return job_id
2. Check document_jobs table for job record
3. Verify Inngest processes the job
4. Verify tailored_profile is created on completion

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete tailor Inngest migration"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_tailor_job_type.sql` | Add tailor job type, phases, tailored_profile_id |
| `apps/web/src/inngest/client.ts` | Add tailor/process event type |
| `packages/shared/src/types/jobs.ts` | Add tailor phases and ticker messages |
| `apps/web/src/inngest/functions/process-tailor.ts` | New Inngest function |
| `apps/web/src/inngest/index.ts` | Export processTailor |
| `apps/web/src/app/api/v1/opportunities/[id]/tailor/route.ts` | Refactor to async |
| `apps/web/src/app/api/v1/opportunities/add-and-tailor/route.ts` | Refactor to async |
| `apps/web/src/app/api/v1/opportunities/add-tailor-share/route.ts` | Refactor to async |
| Tests | Update expectations |
