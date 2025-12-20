# Story Extraction Design

**Date:** 2025-12-18
**Status:** Approved

## Overview

Add story extraction as a second input method alongside resume upload. Stories are free-form text narratives that feed into the same evidence → claims synthesis pipeline.

### Design Principles

1. **Align with resume flow** - Same SSE streaming, same claim synthesis
2. **Keep it simple** - No structured extraction (STAR format, work history)
3. **Reuse existing infrastructure** - Same database tables, same synthesis logic

## Architecture

### New Components

| Component | Purpose |
|-----------|---------|
| `/api/process-story/route.ts` | SSE endpoint for story processing |
| `/components/story-input.tsx` | Text area with submit button |
| `/lib/ai/extract-story-evidence.ts` | Story-specific evidence extractor |

### Processing Flow

```
Text Input → Hash/Dedup Check → Extract Evidence → Generate Embeddings → Synthesize Claims → Done
```

### Phases

1. `validating` - Check for duplicates via content hash
2. `extracting` - AI extracts evidence from story narrative
3. `embeddings` - Generate vector embeddings for evidence
4. `synthesis` - Synthesize evidence into identity claims

## Evidence Extraction

### Types Extracted

- `accomplishment` - Achievements mentioned in narrative
- `skill_listed` - Skills demonstrated or explicitly mentioned
- `trait_indicator` - Character traits shown through actions
- `education` / `certification` - If mentioned in passing

### Context Handling

Company/role context captured inline with evidence (no separate work history extraction):

```json
{
  "text": "Led migration of 500 microservices to Kubernetes",
  "type": "accomplishment",
  "context": { "company": "Google", "role": "Staff Engineer" }
}
```

### Expected Output

Stories typically yield 3-10 evidence items (vs 50-80 from resumes).

## Frontend

### StoryInput Component

```
┌─────────────────────────────────────────────────┐
│  Share a story about your experience            │
│  ─────────────────────────────────────────────  │
│  │                                           │  │
│  │  (textarea - 6-8 rows)                    │  │
│  │                                           │  │
│  ─────────────────────────────────────────────  │
│  200 characters minimum                         │
│                                    [ Submit ]   │
└─────────────────────────────────────────────────┘
```

### Processing State

- Same phase indicators as resume (checkmarks, spinners)
- Highlights feed showing extracted evidence
- "Processing complete!" on success

### Validation

- Minimum: 200 characters
- Maximum: 10,000 characters

### Page Layout

Side-by-side on `/identity` page:
- Left card: Resume upload (existing)
- Right card: Story input (new)

Both visible simultaneously (no tabs).

## API Design

### Endpoint

`POST /api/process-story`

### Request

```json
{
  "text": "When I was at Google, I led a team..."
}
```

JSON body (not FormData - no file upload needed).

### Response

SSE stream (same format as resume):

```
data: {"phase":"validating"}
data: {"phase":"extracting"}
data: {"highlight":"Led migration of 500 microservices"}
data: {"phase":"embeddings"}
data: {"phase":"synthesis","progress":"1/3"}
data: {"done":true,"claimsCount":5}
```

## Database

### No Schema Changes Required

- `documents` table: Use `type = 'story'`, store raw text in `raw_text`
- `evidence` table: Works as-is
- `identity_claims` table: Unchanged

### Deduplication

- SHA-256 hash of story text
- Unique constraint `(user_id, content_hash)` prevents duplicates
- Same approach as resume deduplication

## What's NOT Included

- STAR format extraction (over-engineering for simple input)
- Separate work history extraction (context captured inline)
- File storage (text stored in database directly)
- Story type classification (achievement/challenge/learning)
- Highlights extraction step (evidence items serve as highlights)

## Files to Create/Modify

### New Files

1. `src/app/api/process-story/route.ts` - API endpoint
2. `src/components/story-input.tsx` - Frontend component
3. `src/lib/ai/extract-story-evidence.ts` - Evidence extraction

### Modified Files

1. `src/app/identity/page.tsx` - Add story input alongside resume upload
