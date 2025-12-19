# Profile Management Design

**Goal:** Enable users to view and edit their persistent career data (contact info, work history, ventures, skills, certifications, education) through a dedicated Profile page. Changes apply to all future tailored resumes.

**Key Distinction:**
- **Profile page** = source of truth, structural career data
- **Tailored resume** = AI-generated content for a specific opportunity, editable per-opportunity

---

## Information Architecture

**Navigation:** Top-level nav item at `/profile`, alongside Opportunities.

**Header messaging:**
> "Your Profile is the source of truth about your career. This data feeds into every tailored resume. Edit your work history, contact info, skills, and certifications here. Changes apply to all future resumes."

**Page sections (vertical scroll, collapsible):**

1. **Contact Info** - Name, email, phone, location, LinkedIn, GitHub, website, logo URL
2. **Work History** - Jobs with company, title, dates, location, logo domain
3. **Ventures & Projects** - Side projects, startups (entry_type = 'venture')
4. **Skills** - Grouped by category, with add/edit/delete
5. **Certifications** - Name, issuer, date
6. **Education** - School, degree, field, dates

---

## Data Model Changes

**Minimal changes. Mostly UI work.**

### profiles table - add 1 column:
```sql
ALTER TABLE profiles ADD COLUMN logo_url text;
COMMENT ON COLUMN profiles.logo_url IS 'URL to user personal logo/branding image for resume header';
```

### identity_claims table - add 1 column:
```sql
ALTER TABLE identity_claims ADD COLUMN source text DEFAULT 'extracted'
  CHECK (source IN ('extracted', 'manual'));
COMMENT ON COLUMN identity_claims.source IS 'Whether claim was extracted from documents or manually added by user';
```

### No new tables

Reuse existing:
- `profiles` → contact info + logo
- `work_history` → jobs and ventures (distinguished by `entry_type`)
- `evidence` → certifications and education (filtered by `evidence_type`)
- `identity_claims` → skills (filtered by `type = 'skill'`)

---

## UI Components & Interactions

### Pattern per section:

**View Mode (default):**
- Section header with collapse/expand toggle
- Read-only display of items
- "Edit" button in section header → enters Edit Mode

**Edit Mode:**
- Inline editing of existing items (click to edit fields)
- "Add New" button at bottom of list
- "Delete" action per item (with confirmation)
- "Done" button to exit edit mode
- Changes save immediately (optimistic UI with error handling)

### Component mapping:

| Section | View Display | Edit Controls |
|---------|--------------|---------------|
| Contact Info | Simple key-value list | Input fields, URL validation for links |
| Work History | Cards with company logo, title, dates | Form with company, title, start/end date, location, logo domain |
| Ventures | Same as work history | Same, but entry_type locked to 'venture' |
| Skills | Chips/tags grouped by category | Add via text input, delete via X button |
| Certifications | List with name, issuer, date | Simple form, parse from evidence.context JSON |
| Education | List with school, degree, dates | Same approach |

**No modal forms** - everything edits inline to reduce friction.

---

## API Design

### GET /api/profile

Returns all profile data in one call:
```typescript
{
  contact: { name, email, phone, location, linkedin, github, website, logo_url },
  workHistory: [...],      // entry_type = 'work' or 'additional'
  ventures: [...],         // entry_type = 'venture'
  skills: [...],           // identity_claims where type = 'skill'
  certifications: [...],   // evidence where evidence_type = 'certification'
  education: [...]         // evidence where evidence_type = 'education'
}
```

### PATCH /api/profile/contact

Updates profiles table fields.

### CRUD routes for structured data:

- `POST/PATCH/DELETE /api/profile/work-history/:id`
- `POST/PATCH/DELETE /api/profile/skills/:id`
- `POST/PATCH/DELETE /api/profile/certifications/:id`
- `POST/PATCH/DELETE /api/profile/education/:id`

All routes auth-gated via `supabase.auth.getUser()`, scoped to current user.

---

## Implementation Order

1. **Database migrations** - Add `logo_url` to profiles, `source` to identity_claims
2. **GET /api/profile** - Aggregate query, proves data access works
3. **Profile page shell** - Navigation, layout, section headers with placeholder content
4. **Contact Info section** - Simplest CRUD, good starting point
5. **Work History section** - Most complex, includes logo domain lookup
6. **Ventures section** - Reuses Work History components with filter
7. **Skills section** - Different UI (tags vs cards), tests identity_claims writes
8. **Certifications & Education** - Similar pattern, both use evidence table

---

## Edge Cases

| Case | Handling |
|------|----------|
| Empty sections | Show "No items yet. Add one?" prompt |
| Work history with linked evidence | Deleting a job should NOT cascade-delete evidence (it's still valid career data) |
| Manual skill duplicate | Check if skill label already exists before insert |
| Logo URL invalid | Validate URL format, show fallback if image fails to load |
| Concurrent edits | Last write wins (simple), show toast on save |

---

## Out of Scope (v1)

- Drag-to-reorder (can add later via `order_index`)
- Bulk import/export
- Profile completeness score
