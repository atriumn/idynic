# Migrate Tailoring Profile to Inngest

**Status:** Done
**Completed:** 2026-01-03 (PR #100)

## Progress (Last reviewed: 2026-01-04)

| Step | Status | Notes |
|------|--------|-------|
| Database Migration | ✅ Complete | `20260103000000_tailor_job_type.sql` |
| Inngest Event Type | ✅ Complete | `tailor/process` in client.ts |
| Inngest Function | ✅ Complete | `process-tailor.ts` with 8 steps |
| API Refactor | ✅ Complete | All 3 endpoints migrated |
| Shared Types | ✅ Complete | TAILOR_PHASES, ticker messages |

### Drift Notes
Implementation matches design exactly. All endpoints now return job_id for async, cached profiles return sync.

---

## Overview

Migrate the tailoring profile endpoint from synchronous processing to async background processing via Inngest, matching the pattern used by resume, story, and opportunity processing.

## Problem

The current tailoring endpoints run synchronously, which:
- Risk timeouts on slow AI generation
- Block the request thread during processing
- Don't provide progress visibility to users
- Inconsistent with other processing endpoints

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Migration strategy | Breaking change | Cleaner than maintaining two patterns |
| Job storage | Reuse `document_jobs` table | Same hooks/patterns work, simpler |
| Cached profiles | Hybrid - return cached sync | Best UX for instant cache hits |
| add-tailor-share | Also async | Consistency across all tailoring flows |

## API Contract

### POST `/api/v1/opportunities/[id]/tailor`

**When generation needed (async):**
```json
{
  "job_id": "uuid",
  "status": "processing",
  "message": "Tailoring in progress"
}
```

**When cached (sync):**
```json
{
  "id": "profile-uuid",
  "opportunity": { "id": "...", "title": "...", "company": "..." },
  "narrative": "...",
  "resume_data": { ... },
  "cached": true,
  "created_at": "..."
}
```

**Client detection:** Check for `job_id` (async) vs `id` (cached/sync) in response.

**Regenerate:** `{ "regenerate": true }` always creates a new job.

## Database Changes

### Migration: Add `opportunity_id` to `document_jobs`

```sql
ALTER TABLE document_jobs
ADD COLUMN opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;

COMMENT ON COLUMN document_jobs.opportunity_id IS 'For tailor jobs: the opportunity being tailored';
```

## Inngest Setup

### Event Type (client.ts)

```typescript
type Events = {
  "resume/process": { ... },
  "story/process": { ... },
  "opportunity/process": { ... },
  "tailor/process": {
    data: {
      jobId: string;
      userId: string;
      opportunityId: string;
      regenerate: boolean;
    };
  };
};
```

### Function: process-tailor.ts

Phases:
1. `analyzing` - Generate talking points
2. `generating` - Generate narrative and resume
3. `evaluating` - Run evaluation
4. Complete - Store profile, mark job done

## Implementation Flow

### Tailor Endpoint

```
1. Validate auth & opportunity ownership
2. If not regenerate:
   - Check for cached profile
   - If exists → return full profile immediately (sync)
3. Check billing limit (checkTailoredProfileLimit)
4. Create document_jobs record:
   - job_type: 'tailor'
   - opportunity_id: id
   - status: 'pending'
5. Send tailor/process event to Inngest
6. Return { job_id, status: 'processing' }
```

### Inngest Function

```
1. Update job → phase: 'analyzing', status: 'processing'
2. Fetch opportunity and user documents
3. Generate talking points
4. Update job → phase: 'generating'
5. Generate narrative
6. Generate resume data
7. Store tailored_profiles record
8. Update job → phase: 'evaluating'
9. Run evaluateTailoredProfile()
10. Store tailoring_eval_log
11. Increment usage count
12. Update job → status: 'completed', store profile_id in result
```

### Error Handling

On any error:
- Update job → `status: 'failed'`, `error_message: <error>`
- Do not increment usage count
- Inngest handles retries automatically

## Files to Change

### Database
- `supabase/migrations/XXXXXX_add_opportunity_id_to_document_jobs.sql`

### Inngest
- `src/inngest/client.ts` - Add `tailor/process` event type
- `src/inngest/index.ts` - Export new function
- `src/inngest/functions/process-tailor.ts` - New file

### API Endpoints
- `src/app/api/v1/opportunities/[id]/tailor/route.ts` - Refactor to async
- `src/app/api/v1/opportunities/add-and-tailor/route.ts` - Return job_id
- `src/app/api/v1/opportunities/add-tailor-share/route.ts` - Return job_id

### Web App
- Components calling tailor endpoints need to handle job-based flow
- Reuse `useDocumentJob` hook for progress tracking
- Update UI to show tailoring progress states

## Client Migration

### Web App
- Uses Supabase Realtime via `useDocumentJob` hook
- Subscribe to job updates, fetch profile on completion

### API Clients (Mobile, External)
- Poll `document_jobs` table for status
- Fetch profile via GET `/api/v1/opportunities/[id]/tailored-profile` on completion

## Affected Endpoints Summary

| Endpoint | Current | After Migration |
|----------|---------|-----------------|
| `POST /opportunities/[id]/tailor` | Sync, returns profile | Async (unless cached) |
| `POST /opportunities/add-and-tailor` | Sync, returns profile | Async, returns job_id |
| `POST /opportunities/add-tailor-share` | Sync, returns share link | Async, returns job_id |
