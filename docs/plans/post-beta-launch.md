# Post-Beta Launch Tasks

> Created 2025-12-28 after completing beta launch checklist

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

- [x] Fix function `search_path` on custom functions (migration: `fix_function_search_paths`)
- [ ] ~~Move `vector` extension to `extensions` schema~~ - Deferred: low risk (pure math functions), high complexity (4 tables + indexes depend on it)

---

## Onboarding Prompts

> See full design: [2026-01-01-onboarding-prompts-design.md](./2026-01-01-onboarding-prompts-design.md)

Lightweight "next steps" prompts (not full wizard) - shared logic for web + mobile.

### Implementation Checklist
- [x] Phase 1: Create shared foundation (`packages/shared/src/content/onboarding.ts`, `useOnboardingProgress` hook) - PR #79
- [x] Phase 2: Web integration (storage adapter, OnboardingPrompt component, trigger points) - PR #82
- [x] Phase 3: Mobile integration (AsyncStorage adapter, OnboardingPrompt component, trigger points) - PR #84
- [ ] Phase 4: Testing & polish

---

## Operational

- [x] Set up Axiom logging (completed, plan archived)
- [x] Document environment variables needed for deployment (see `.env.example`)
