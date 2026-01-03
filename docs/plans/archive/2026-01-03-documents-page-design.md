# Documents Page Design

**Status:** Done

## Progress (Last reviewed: 2026-01-03)

| Step | Status | Notes |
|------|--------|-------|
| Documents list page | ✅ Complete | PR #95 |
| Documents detail page | ✅ Complete | PR #95 |
| Clickable source badges | ✅ Complete | PR #95 |
| Mobile documents screens | ✅ Complete | PR #95 |
| API endpoints | ✅ Complete | PR #95 |

### Notes
Merged in PR #95 (2026-01-03). Ready to archive.

## Overview

A simple documents page that lets users view all their uploaded documents (resumes and stories) and see what evidence was extracted from each one.

## Access Points

1. **"My Documents" link** in Identity page header → navigates to `/documents`
2. **Evidence source badges** on claims → click navigates directly to `/documents/[id]`

## Routes

| Platform | List View | Detail View |
|----------|-----------|-------------|
| Web | `/documents` | `/documents/[id]` |
| Mobile | `/(app)/documents` | `/(app)/documents/[id]` |

## Documents List View

**Layout:** Simple table/list

**Columns:**
- Document name (filename for resumes, truncated first line for stories)
- Type badge ("Resume" or "Story")
- Date uploaded

**Behavior:**
- Sorted by date descending (newest first)
- Click any row → navigate to document detail

**Empty state:** "No documents yet. Upload a resume or add a story to get started." with links to upload flows.

## Document Detail View

### Header
- Back link → returns to `/documents` (or previous page if came from badge)
- Document name
- Type badge + upload date

### Content Section
- For resumes: Display extracted `raw_text` in readable prose format
- For stories: Display the story text as submitted

### Evidence Section
- Heading: "What we learned"
- Simple list of evidence items extracted from this document
- Each item shows:
  - Evidence text
  - Type badge (accomplishment/skill/trait)
  - Date if available
- No click-through to claims (keeping it simple)

### Layout
- Content takes primary space
- Evidence as secondary section below content (or sidebar on wider screens)

## Identity Page Changes

### Clickable Source Badges

**Existing behavior:** Claims display evidence source badges (e.g., "Resume - Jan 2024")

**New behavior:**
- Badges become clickable links
- Click navigates to `/documents/[id]` for that source document
- Visual affordance: cursor pointer, subtle hover state

**Implementation notes:**
- Evidence records already have `document_id` linking to source
- Badge component gets `href` prop or wrapped in `Link`
- Same pattern for web (Next.js Link) and mobile (expo-router Link)

## Data Requirements

Uses existing tables:
- `documents` - id, user_id, type, filename, raw_text, created_at
- `evidence` - id, document_id, text, evidence_type, evidence_date

No schema changes required.

## Out of Scope

- Edit/delete functionality
- Search or filtering
- Bulk actions
- Document re-processing
