# Opportunity Notes Design

**Status:** Implemented

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to capture personal notes, ratings, and related links for each opportunity.

**Architecture:** A new `opportunity_notes` table with a Notes tab on the opportunity detail page. Auto-saves as users interact.

**Tech Stack:** Next.js API routes, Supabase, React components with Phosphor icons.

---

## Data Model

New table `opportunity_notes`:

```sql
create table opportunity_notes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Ratings (1-5, nullable)
  rating_tech_stack smallint check (rating_tech_stack >= 1 and rating_tech_stack <= 5),
  rating_company smallint check (rating_company >= 1 and rating_company <= 5),
  rating_industry smallint check (rating_industry >= 1 and rating_industry <= 5),
  rating_role_fit smallint check (rating_role_fit >= 1 and rating_role_fit <= 5),

  -- Links as JSONB array: [{url: string, label: string | null, type: string}]
  links jsonb not null default '[]'::jsonb,

  -- Free-form notes
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(opportunity_id, user_id)
);

-- RLS policies
alter table opportunity_notes enable row level security;

create policy "Users can manage their own notes"
  on opportunity_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## UI Design

### Notes Tab

A new tab on the opportunity detail page with three sections:

**1. Ratings Row (horizontal, compact)**
- Four rating groups side by side: Tech Stack, Company, Industry, Role Fit
- Each shows 5 clickable numbered buttons (1-5)
- Unrated = gray/empty, rated = highlighted
- Click same number to clear rating
- Saves immediately on click

**2. Links Section**
- List of saved links showing: auto-detected icon, label, URL
- "Add link" button with inline form: URL input + optional label
- Auto-detects link type on paste, shows preview before saving
- Delete button (X) on each link

**3. Notes Section**
- Single auto-expanding textarea
- Placeholder: "Add your thoughts about this opportunity..."
- Auto-saves on debounce (500ms after typing stops)

### Auto-save Indicator
- Subtle "Saving..." / "Saved" text in corner
- No explicit save button

## API Design

### GET /api/opportunity-notes?opportunityId=X

Returns notes for an opportunity (or empty defaults if none exist).

```typescript
{
  rating_tech_stack: number | null,
  rating_company: number | null,
  rating_industry: number | null,
  rating_role_fit: number | null,
  links: Array<{ url: string, label: string | null, type: string }>,
  notes: string | null
}
```

### PUT /api/opportunity-notes

Upserts notes for an opportunity.

```typescript
// Request body
{
  opportunityId: string,
  rating_tech_stack?: number | null,
  rating_company?: number | null,
  rating_industry?: number | null,
  rating_role_fit?: number | null,
  links?: Array<{ url: string, label: string | null, type: string }>,
  notes?: string | null
}
```

## Components

### OpportunityNotes
Main client component. Fetches notes on mount, handles saving.

### RatingInput
Reusable 1-5 rating with label. Props: `label`, `value`, `onChange`.

### SmartLinksList
Manages links list. Props: `links`, `onAdd`, `onRemove`.

### SmartLinkInput
URL input with auto-detection. Shows icon preview before adding.

## URL Type Detection

Reuse logic from `add-opportunity-dialog.tsx`:

| Domain pattern | Type | Icon |
|----------------|------|------|
| linkedin.com | linkedin | LinkedinLogo |
| glassdoor.com | glassdoor | generic job |
| indeed.com | indeed | generic job |
| greenhouse.io | greenhouse | generic job |
| lever.co | lever | generic job |
| *.myworkdayjobs.com | workday | generic job |
| jobs.* or careers.* | careers | generic job |
| * | link | generic link |

## Implementation Tasks

1. Create migration for `opportunity_notes` table
2. Create API route `GET /api/opportunity-notes`
3. Create API route `PUT /api/opportunity-notes`
4. Create `RatingInput` component
5. Create `SmartLinkInput` component with URL detection
6. Create `SmartLinksList` component
7. Create `OpportunityNotes` component
8. Add Notes tab to opportunity detail page
9. Test auto-save behavior
