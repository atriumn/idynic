# Identity Reflection Feature Design

**Date:** 2025-12-23
**Status:** Done
**Author:** Brainstorming session

## Progress (Last reviewed: 2025-12-27)

| Step | Status | Notes |
|------|--------|-------|
| Database schema changes | ✅ Complete | Commit 2727e9dc |
| LLM reflect-identity.ts | ✅ Complete | Commit 2727e9dc |
| Integration with process-resume | ✅ Complete | Commit 2727e9dc |
| Integration with process-story | ✅ Complete | Commit 2727e9dc |
| UI component IdentityReflection | ✅ Complete | Commit 2727e9dc |
| SSE REFLECTION phase | ✅ Complete | Commit 2727e9dc |

### Implementation Notes
Feature fully implemented. Identity reflection (headline, bio, archetype, keywords, matches) is generated automatically after resume/story processing.

## Overview

Transform the granular list of identity claims into a high-level professional narrative that makes users feel "seen" immediately after upload. This feature synthesizes claims into an archetype, headline, bio, keywords, and job matches.

## Goals

1. **Summarize** — Distill dozens of claims into a coherent professional identity
2. **Suggest jobs** — Recommend specific roles the user would excel at
3. **Create excitement** — The archetype/persona creates an "aha moment"

## Data Model

Add the following fields to the `profiles` table:

```sql
ALTER TABLE profiles ADD COLUMN identity_headline TEXT;
ALTER TABLE profiles ADD COLUMN identity_bio TEXT;
ALTER TABLE profiles ADD COLUMN identity_archetype TEXT;
ALTER TABLE profiles ADD COLUMN identity_keywords JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN identity_matches JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN identity_generated_at TIMESTAMPTZ;
```

### Field Specifications

| Field | Type | Nullable | Generation Threshold | Description |
|-------|------|----------|---------------------|-------------|
| `identity_headline` | text | Yes | 1+ claims | 6-10 word professional tagline |
| `identity_bio` | text | Yes | 5+ claims | 2-3 sentence narrative in second person |
| `identity_archetype` | text | Yes | 1+ claims | One of 10 universal archetypes |
| `identity_keywords` | jsonb | Yes | 3+ claims | Array of 3-5 defining attributes |
| `identity_matches` | jsonb | Yes | 10+ claims | Array of 3 specific job titles |
| `identity_generated_at` | timestamptz | Yes | — | Timestamp of last generation |

### Archetype System

The `identity_archetype` field is constrained to these 10 universal, profession-agnostic values:

| Archetype | Core Trait | Example Personas |
|-----------|-----------|------------------|
| Builder | Creates new things from scratch | Contractor, founder, product developer |
| Optimizer | Makes things faster/cheaper/better | Operations manager, process engineer |
| Connector | Builds relationships, bridges gaps | Sales, recruiter, community organizer |
| Guide | Develops others, transfers knowledge | Teacher, mentor, coach |
| Stabilizer | Brings order to chaos | Project manager, ER nurse, crisis responder |
| Specialist | Deep mastery of a craft | Surgeon, master electrician, tax attorney |
| Strategist | Sees the big picture, plans ahead | Executive, military officer, campaign manager |
| Advocate | Champions people or causes | Union rep, public defender, activist |
| Investigator | Finds truth, solves puzzles | Detective, auditor, researcher, journalist |
| Performer | Excels under pressure, in the spotlight | Sales closer, litigator, presenter |

## Technical Flow

### Trigger

Runs automatically at the end of `POST /api/process-resume` and `POST /api/process-story`, immediately after claim synthesis completes.

### New File: `src/lib/ai/reflect-identity.ts`

```typescript
export async function reflectIdentity(
  userId: string,
  sse: SSEStream
): Promise<void>
```

### Process Steps

1. **Fetch claims** — Query top 50 `identity_claims` for user, ordered by confidence DESC
2. **Check threshold** — Count claims to determine which fields to generate
3. **Build prompt** — Include claim labels, types, descriptions, confidence scores
4. **LLM call** — Single call using existing model config (gpt-4o-mini) with JSON mode
5. **Validate archetype** — Ensure returned archetype is in allowed list
6. **Persist** — Update `profiles` table with generated fields + timestamp
7. **SSE event** — Send `{ phase: 'REFLECTION', progress: 'complete' }`

### Claim Thresholds for Partial Generation

| Claim Count | Fields Generated |
|-------------|-----------------|
| 1+ | headline, archetype |
| 3+ | + keywords |
| 5+ | + bio |
| 10+ | + matches |

### Cost Estimate

~500-800 tokens per call ≈ $0.001 per reflection

## LLM Prompt Design

### System Prompt

```
You are an executive career coach analyzing a professional's verified claims.
Your job is to synthesize these into a compelling identity snapshot.

ARCHETYPE OPTIONS (pick exactly one):
- Builder: Creates new things from scratch
- Optimizer: Makes things faster/cheaper/better
- Connector: Builds relationships, bridges gaps
- Guide: Develops others, transfers knowledge
- Stabilizer: Brings order to chaos
- Specialist: Deep mastery of a craft
- Strategist: Sees the big picture, plans ahead
- Advocate: Champions people or causes
- Investigator: Finds truth, solves puzzles
- Performer: Excels under pressure, in the spotlight

RULES:
- Write in second person ("You thrive in...")
- Be specific — reference actual skills/achievements from claims
- Headline: 6-10 words, no fluff, professional but distinctive
- Bio: 2-3 sentences emphasizing impact, not just duties
- Keywords: The 3-5 most defining attributes (not generic like "hardworking")
- Matches: Specific job titles they'd excel at, not broad categories
- Return null for any field you lack confidence to generate
```

### User Prompt

Includes claim type, label, description, and confidence for each of the top 50 claims.

### Response Format

JSON with nullable fields matching the data model.

## UI Implementation

### Component: `src/components/identity/identity-reflection.tsx`

**Location:** Top of `/app/identity/page.tsx` (Hero section)

### States

1. **Empty** — No reflection generated yet. Show nothing (or subtle upload prompt if no claims).
2. **Generating** — SSE stream active with `phase: 'REFLECTION'`. Skeleton pulse with "Synthesizing your profile..."
3. **Partial** — Some fields populated. Render what exists, subtle prompt for missing sections.
4. **Complete** — All fields populated. Full card display.

### Card Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────┐                                           │
│  │  STRATEGIST  │  ← Archetype badge (colored)              │
│  └──────────────┘                                           │
│                                                             │
│  Full-Stack Architect Specializing in High-Scale Systems    │
│  ↑ Headline (large text)                                    │
│                                                             │
│  You bridge the gap between complex backend logic and       │
│  user-centric design. You thrive in chaotic 0-to-1          │
│  environments where technical decisions shape product.      │
│  ↑ Bio (body text)                                          │
│                                                             │
│  ┌─────────────┐ ┌───────────┐ ┌──────────────────┐         │
│  │ Concurrency │ │ Mentorship│ │ Rapid Prototyping│ ← Keywords
│  └─────────────┘ └───────────┘ └──────────────────┘         │
│                                                             │
│  Best fit roles: Staff Engineer · Tech Lead · Solutions Arch│
│  ↑ Matches (subtle footer)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Archetype Badge Colors

Each archetype gets a distinct color for visual identity:

| Archetype | Color |
|-----------|-------|
| Builder | Amber |
| Optimizer | Emerald |
| Connector | Sky |
| Guide | Violet |
| Stabilizer | Slate |
| Specialist | Rose |
| Strategist | Indigo |
| Advocate | Orange |
| Investigator | Cyan |
| Performer | Fuchsia |

## Edge Cases & Error Handling

### LLM Failures

- Log error and send SSE warning: `{ warning: "Couldn't generate identity snapshot" }`
- Don't block upload completion — rest of processing succeeded
- Regenerates on next upload

### Invalid Archetype Returned

- If LLM returns archetype not in allowed list, set to `null`
- Log for monitoring (may indicate prompt drift)

### User Has Claims But No Reflection

- Edge case: user uploaded before feature existed
- Check for `identity_generated_at IS NULL` with claim count > 0
- Future: trigger on page load or prompt "Refresh your snapshot"

### Deleted All Documents

- If claims drop to 0, set all identity fields to `null`
- Handle in existing document deletion flow

### Concurrent Uploads

- Both uploads trigger reflection — last one wins
- Acceptable: reflection is cheap and idempotent

## Regeneration Strategy

**V1:** Full regenerate on each document upload.

- Claims change confidence with each upload (recency decay, new evidence)
- Reflection should always represent current state
- Simple implementation, no stale data concerns

## Files to Create/Modify

### New Files

1. `src/lib/ai/reflect-identity.ts` — Core generation logic
2. `src/components/identity/identity-reflection.tsx` — UI component

### Modified Files

1. `supabase/migrations/XXXXXX_add_identity_reflection.sql` — Schema migration
2. `src/app/api/process-resume/route.ts` — Add REFLECTION phase
3. `src/app/api/process-story/route.ts` — Add REFLECTION phase
4. `src/app/identity/page.tsx` — Add IdentityReflection component
5. `src/lib/sse/types.ts` — Add REFLECTION to ProcessingPhase enum

## Future Enhancements (Not V1)

- **Version history** — Store reflection snapshots, show career journey over time
- **Expand archetypes** — Add new archetypes based on real-world usage patterns
- **Refresh button** — Manual regeneration for users with stale data
- **Archetype matching** — Find other users with similar archetypes
