# Post-Beta Launch Tasks

> Created 2025-12-28 after completing beta launch checklist

**Status:** In Progress

## Progress (Last reviewed: 2025-12-31)

| Section | Status | Notes |
|---------|--------|-------|
| Delete My Account | ✅ Complete | All GDPR deletion functionality implemented |
| Export My Data | ✅ Complete | JSON + ZIP export working |
| Security Hardening | ⏳ Not Started | search_path and vector schema migrations pending |
| Onboarding Prompts | ⏳ Not Started | Shared logic for web+mobile not yet implemented |
| Operational | ⏳ Not Started | Axiom logging and env var docs pending |

## Data Management (GDPR)

### Delete My Account
- [x] Add "Delete My Account" button to settings page
- [x] Create `DELETE /api/v1/account` endpoint that:
  - Deletes all user data across tables (profiles, identity_claims, evidence, claim_evidence, work_history, documents, opportunities, tailored_profiles, shared_links, matches, api_keys, usage_tracking, subscriptions, opportunity_notes, document_jobs)
  - Deletes storage files (resume PDFs)
  - Cancels Stripe subscription if active
  - Deletes Supabase Auth user record
- [x] Add confirmation modal with password verification
- [ ] Send confirmation email after deletion (optional enhancement)

### Export My Data
- [x] Add "Export My Data" button to settings page
- [x] Create `POST /api/v1/account/export` endpoint that:
  - Exports all user data as JSON
  - Includes original uploaded files (PDFs)
  - Covers: profile, work_history, identity_claims, evidence, opportunities, tailored_profiles
- [x] Deliver as ZIP download

---

## Security Hardening

- [ ] Fix function `search_path` warnings (16 functions) - create migration to set `search_path = ''`
- [ ] Move `vector` extension from public schema to `extensions` schema

---

## Onboarding Prompts

Lightweight "next steps" prompts (not full wizard) - shared logic for web + mobile.

### Architecture
```
packages/shared/src/
├── content/
│   └── onboarding.ts       # Prompt copy for each milestone
└── hooks/
    └── useOnboardingProgress.ts  # Milestone tracking logic
```

### Implementation
- [ ] Create `packages/shared/src/content/onboarding.ts` with prompt copy
- [ ] Create `packages/shared/src/hooks/useOnboardingProgress.ts`
  - Track milestones: `resume_uploaded`, `story_added`, `opportunity_added`, `profile_tailored`
  - Accept storage adapter (localStorage for web, AsyncStorage for mobile)
- [ ] Web: Add OnboardingPrompt component using existing toast system
- [ ] Mobile: Add OnboardingPrompt component (React Native toast or bottom sheet)
- [ ] Wire up trigger points:
  - After resume upload → "Explore your claims or add an opportunity"
  - After story added → "Add more stories or upload a resume"
  - After opportunity added → "Try tailoring to see your match"
  - After profile tailored → "Share with a recruiter or download PDF"

### UI Behavior
- Prompts persist until dismissed (not auto-dismiss)
- Include action button linking to suggested next step
- Only show each prompt once per user (tracked via storage)

---

## Operational

- [ ] Set up Axiom logging - see `docs/plans/axiom-setup.md`
- [ ] Document environment variables needed for deployment (for bus factor)
