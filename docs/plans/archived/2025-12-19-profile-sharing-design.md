# Profile Sharing for Recruiters & Hiring Managers

**Date:** 2025-12-19
**Status:** Implemented

## Overview

Enable candidates to share private, tailored profile links with recruiters and hiring managers. Links are role-specific, time-limited, and trackable.

## Goals

**MVP:**
- Candidates generate private share links for tailored profiles
- Recruiters/hiring managers view profiles without needing an idynic account
- Candidates track views and control access

**Post-MVP Placeholder:**
- Landing page with waitlist for recruiters/hiring managers
- Foundation for future job posting and candidate discovery features

## Non-Goals (Future)

- Recruiter/hiring manager accounts
- Job posting functionality
- Candidate discovery/search
- Talking points (internal to candidate only)

---

## Data Model

### New table: `shared_links`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tailored_profile_id` | UUID | FK to tailored_profiles (unique - one link per profile) |
| `user_id` | UUID | FK to profiles (for RLS) |
| `token` | VARCHAR(32) | Random unguessable token for URL |
| `expires_at` | TIMESTAMP | When the link expires |
| `revoked_at` | TIMESTAMP | Null if active, set when revoked |
| `created_at` | TIMESTAMP | When link was created |

### New table: `shared_link_views`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `shared_link_id` | UUID | FK to shared_links |
| `viewed_at` | TIMESTAMP | When the view occurred |

### New table: `recruiter_waitlist`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `email` | VARCHAR | Email address |
| `created_at` | TIMESTAMP | When they signed up |

### RLS Policies

**shared_links:**
- Candidates can CRUD their own links (`auth.uid() = user_id`)
- Public can read by token (non-revoked, non-expired only)

**shared_link_views:**
- Candidates can read views for their own links
- System inserts views (via service role or public insert policy)

**recruiter_waitlist:**
- Public insert (no auth required)
- No public read access

---

## Candidate Experience

### Share Button on Tailored Profile

Location: `/opportunities/[id]` (tailored profile page)

**First time (no link exists):**
- "Share" button opens modal
- Expiration picker: 7 days, 30 days (default), 90 days, No expiration
- "Generate Link" creates link and displays it with copy button

**Link exists:**
- Modal shows existing link with copy button
- Displays: expiration date, view count
- Actions: "Revoke" (with confirmation), "Extend" expiration

### Shared Links Dashboard

Location: `/shared-links`

Table listing all shared links:

| Opportunity | Status | Views | Expires | Actions |
|-------------|--------|-------|---------|---------|
| Senior Eng @ Acme | Active | 3 views | Dec 28 | Copy, Revoke |
| PM @ Startup | Expired | 1 view | Dec 10 | Create New |
| Lead @ BigCo | Revoked | 0 views | - | Create New |

**Expanded row shows view timestamps:**
- "Viewed Dec 19 at 2:30pm"
- "Viewed Dec 20 at 9:15am"

**Navigation:** Add "Shared Links" to sidebar.

---

## Recruiter/Hiring Manager View

### Shared Profile Page

Route: `/shared/[token]` (public, no auth required)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [Candidate Name]                    [Download PDF] │
│  [Role they're targeting - from opportunity title]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  NARRATIVE                                          │
│  ───────────                                        │
│  [The tailored narrative text - why they're a      │
│   great fit for this role]                          │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  RESUME                                             │
│  ──────                                             │
│  [Rendered resume - contact info, experience,      │
│   skills, education, certifications - styled        │
│   inline, matching PDF format]                      │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Powered by idynic                                  │
│  Hiring? Get early access → [Join Waitlist]        │
└─────────────────────────────────────────────────────┘
```

**Content shown:**
- Candidate name
- Opportunity/role title
- Tailored narrative
- Rendered resume (inline, styled)
- PDF download button

**Content NOT shown:**
- Talking points (internal to candidate)

### Page States

**Valid link:** Shows profile, logs view timestamp

**Expired link:** Friendly message:
> "This link has expired. Please reach out to [Candidate Name] for a fresh link."

**Revoked link:** Same message as expired (don't distinguish for security)

**Invalid token:** Generic 404

---

## Recruiter/Hiring Manager Waitlist

### Landing Page

Route: `/recruiters` (public, no auth required)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  idynic for Recruiters & Hiring Managers            │
│  ──────────────────────────────────────             │
│                                                     │
│  Coming soon: Post your roles and discover          │
│  pre-qualified candidates with tailored profiles    │
│  matched to your needs.                             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Enter your email          [Get Early Access] │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ✓ View candidate profiles tailored to your role   │
│  ✓ See verified skills and work history            │
│  ✓ Direct connection to candidates                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Success message:** "You're on the list! We'll reach out when we launch."

**Footer CTA on shared profiles:** Links to `/recruiters`

---

## Technical Implementation

### API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/shared-links` | POST | Required | Create share link for a tailored profile |
| `/api/shared-links` | GET | Required | List user's share links with view counts |
| `/api/shared-links/[id]` | PATCH | Required | Update expiration or revoke |
| `/api/shared-links/[id]` | DELETE | Required | Delete link entirely |
| `/api/shared/[token]` | GET | Public | Fetch shared profile data (logs view) |
| `/api/recruiter-waitlist` | POST | Public | Add email to waitlist |

### Token Generation

- 32 characters, cryptographically random
- Use `crypto.randomBytes(16).toString('hex')`
- URL-safe (alphanumeric only)

### PDF Generation

- Reuse existing `@react-pdf/renderer` setup
- Generate on-demand when recruiter clicks download
- Include same content as inline view

### Rate Limiting

- `/api/shared/[token]` - 60 requests per hour per IP
- `/api/recruiter-waitlist` - 5 submissions per hour per IP

### View Logging

- Log every view with timestamp (no deduplication)
- Candidates want to see repeat visits from same viewer
- Consider adding IP/fingerprint later if spam becomes an issue

---

## Security Considerations

**Token security:**
- 32 hex characters = 128 bits of entropy
- Effectively unguessable (billions of years to brute force)

**Access control:**
- Links check both `revoked_at IS NULL` and `expires_at > NOW()`
- RLS enforces candidate ownership for management operations
- Public read only via token lookup, never list access

**Privacy:**
- Expired/revoked show identical message (no information leakage)
- Invalid tokens return 404 (no enumeration)
- View logging doesn't store viewer identity (just timestamp)

---

## Future Considerations (Out of Scope)

These are noted for future planning but explicitly NOT part of this design:

- **Recruiter accounts:** Full accounts with saved candidates, notes
- **Job posting:** Recruiters post roles, candidates get matched
- **Candidate discovery:** Opt-in candidate pool that recruiters can search
- **Messaging:** In-app communication between recruiters and candidates
- **Analytics:** Detailed engagement metrics beyond view timestamps
