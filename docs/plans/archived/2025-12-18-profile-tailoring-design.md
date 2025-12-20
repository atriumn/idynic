# Profile Tailoring Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate tailored "solution profiles" that show how a user's experience solves an employer's problems - for job applications, interview prep, and resume generation.

**Core Principle:** Never lie. Inference and emphasis are allowed; fabrication is not.

---

## Overview

Users upload resumes, which get decomposed into identity claims backed by evidence. When viewing an opportunity, they can generate a tailored profile that:

1. Maps their experience to the opportunity's requirements
2. Identifies gaps and suggests mitigation strategies
3. Generates narrative prose for cover letters
4. Produces a tailored resume with complete career history

All outputs trace back to source evidence. The system reframes and emphasizes - it never invents.

---

## Data Model Changes

### New Table: `work_history`

Stores the canonical job skeleton extracted from resumes.

```sql
create table work_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  document_id uuid references documents(id) on delete cascade not null,
  company text not null,
  title text not null,
  start_date text not null,
  end_date text, -- null = current role
  location text,
  summary text, -- 1-2 sentence role summary
  order_index int not null default 0,
  created_at timestamptz default now() not null
);

create index work_history_user_id_idx on work_history(user_id);
```

### New Table: `tailored_profiles`

Stores generated output per user/opportunity pair.

```sql
create table tailored_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  opportunity_id uuid references opportunities(id) on delete cascade not null,
  talking_points jsonb not null,
  narrative text,
  resume_data jsonb,
  created_at timestamptz default now() not null,
  unique(user_id, opportunity_id)
);

create index tailored_profiles_opportunity_idx on tailored_profiles(opportunity_id);
```

### Update: `evidence` Table

Add foreign key to link evidence to its source job:

```sql
alter table evidence add column work_history_id uuid references work_history(id) on delete set null;
```

### Extraction Changes

Update resume extraction to:
1. Extract work history as structured output alongside evidence
2. Populate `work_history` table with job skeleton
3. Link each evidence record to its `work_history_id`

---

## Talking Points Generation

The foundation for all other outputs. Generated via LLM given opportunity requirements and user claims.

### Structure

```typescript
interface TalkingPoints {
  strengths: Array<{
    requirement: string;
    claim_id: string;
    evidence_summary: string;
    framing: string;
    confidence: number;
  }>;
  gaps: Array<{
    requirement: string;
    mitigation: string;
    related_claims: string[];
  }>;
  inferences: Array<{
    inferred_claim: string;
    derived_from: string[];
    reasoning: string;
  }>;
}
```

### Generation Logic

1. Load opportunity requirements (mustHave, niceToHave)
2. Load user's identity claims with evidence
3. Run vector similarity matching (existing logic)
4. Prompt LLM to:
   - Identify strengths with framing suggestions
   - Identify gaps with mitigation strategies
   - Make reasonable inferences from evidence patterns

### LLM Prompt Guidance

- Every strength must link to a real claim/evidence
- Inferences must be reasonable (led team of 10 → "people management")
- Gap mitigation should be honest, not spin
- Framing suggests emphasis, not fabrication

---

## Narrative Generation

Prose derived from talking points, suitable for cover letters or application fields.

### Generation Logic

1. Take talking points as input
2. Synthesize into natural first-person prose
3. Structure: Lead with strengths, acknowledge gaps with mitigation, close with enthusiasm

### LLM Prompt Guidance

- First person voice ("I led..." not "This candidate...")
- Natural, professional tone
- Lead with value to employer
- 2-3 paragraphs, 200-300 words
- No hallucination - every claim traces to evidence

### Example Output

> My experience leading a 10-person engineering team through a cloud migration directly addresses your need for cross-functional leadership. In that role, I coordinated daily with DevOps, Security, and Product teams to deliver on a tight timeline while maintaining SOC2 compliance.
>
> While I haven't worked with Kubernetes specifically, my deep experience with Docker and AWS ECS gives me strong container orchestration fundamentals, and I'm eager to expand into K8s.

---

## Resume Generation

Reconstructs a complete resume from `work_history` + claims, tailored to the opportunity.

### Generation Logic

1. **Load skeleton** - All `work_history` entries, ordered by date
2. **Load claims per job** - Find claims with evidence from each `work_history_id`
3. **Score relevance** - Match claims against opportunity requirements
4. **Generate bullets** - 3-5 bullets per job, prioritizing relevant claims
5. **Generate summary** - Tailored 2-3 sentence professional summary
6. **Order skills** - Reorder skills section by relevance

### Resume Data Structure

```typescript
interface ResumeData {
  summary: string;
  skills: string[];
  experience: Array<{
    work_history_id: string;
    company: string;
    title: string;
    dates: string;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string;
  }>;
}
```

### Key Constraints

- **No omissions** - Every job appears in the resume
- **Complete story** - Less relevant jobs get fewer bullets, not zero
- **Natural language** - Not keyword mirroring from job posting
- **Subtle emphasis** - Bold 1-2 key concepts per bullet that address requirements

### Emphasis Example

Good:
> Led 10-person team through **cloud migration**, coordinating across DevOps, Security, and Product

Bad:
> Led **cross-functional** team through **cloud migration** delivering **stakeholder management** and **technical leadership**

---

## UX Flow

### Entry Point

Opportunity detail page - new "Tailor Profile" button.

### Flow

1. User clicks "Tailor Profile"
2. Loading state (few seconds for LLM generation)
3. Results view with three tabs:
   - **Talking Points** - Strengths, gaps, inferences
   - **Narrative** - Copy-able prose
   - **Resume** - Preview with copy/download

### Behavior

- All three outputs generated in one flow
- Results persist in `tailored_profiles` - revisit without regenerating
- "Regenerate" button if identity claims have been updated

### MVP Scope

- Markdown/text output (copy-able)
- No PDF generation yet
- No interactive refinement yet

---

## Traceability Chain

Every piece of output traces back to source:

```
Resume bullet
  → work_history (job context)
  → evidence (original resume text)
  → claim_evidence (link)
  → identity_claims (synthesized claim)
```

Talking points include `claim_id` references. Narrative is derived from talking points. Resume bullets are generated from claims tied to work history.

---

## Future Enhancements

Not in MVP, but considered:

1. **Interactive refinement** - Ask follow-ups, adjust framing
2. **Editable workspace** - Tweak generated points, save notes
3. **PDF export** - Professional resume formatting
4. **Template support** - User-provided cover letter styles
5. **Version history** - Track profile changes over time

---

## Implementation Order

1. Add `work_history` table and update extraction
2. Add `tailored_profiles` table
3. Implement talking points generation
4. Implement narrative generation
5. Implement resume generation
6. Build UI (button, loading, tabbed results)
