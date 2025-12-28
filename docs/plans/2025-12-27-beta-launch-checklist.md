# Beta Launch Checklist

> Generated from brainstorming session on 2025-12-27

**Status:** In Progress
**Last Reviewed:** 2025-12-28

## Progress Summary

| Section | Status | Notes |
|---------|--------|-------|
| Data Safety | ✅ Complete | Supabase Pro upgraded |
| Security | ✅ Complete | Leaked password protection enabled |
| Compliance | ✅ Complete | All legal docs updated |
| Operational Readiness (Blocking) | 🔄 In Progress | 1 item remaining (GitHub→Discord webhook) |
| Week 1-2 Items | ⏳ Not Started | Post-launch work |
| Post-Beta Items | ⏳ Not Started | Future work |

---

## Before Launch (Blocking)

### Data Safety
- [x] **Upgrade to Supabase Pro** ($25/mo) - enables daily automated backups with 7-day retention
- [x] Verify backup is working after upgrade (check Dashboard → Database → Backups)

### Security
- [x] **Enable leaked password protection** - Supabase Dashboard → Authentication → Providers → Email → Enable "Leaked password protection" (2 min)
- [x] `beta_codes` RLS confirmed intentional - table locked down, access via security definer functions only

### Compliance
- [x] Privacy Policy - exists at `/legal/privacy`
- [x] Terms of Service - exists at `/legal/terms`
- [x] Cookie Policy - exists at `/legal/cookies`
- [x] **Add ToS/Privacy links to signup page** - Added to both web and mobile signup flows
- [x] **Fix AI training clause in Privacy Policy** - Clarified we use OpenAI API, data NOT used to train models
- [x] **Add billing/subscription section to ToS** - Added section 6 with refund policy (7-day), auto-renewal, cancellation, price changes
- [x] **Verify support@idynic.com is receiving emails** - Google Workspace set up, DKIM/SPF configured

### Operational Readiness
- [x] **Set up UptimeRobot** (free tier) - monitors homepage (`https://idynic.com`) + API health (`https://idynic.com/api/health`)
- [x] **Set up Discord server** for community + support: https://discord.gg/tCeeZDFd
  - Create channels: #announcements, #general, #support, #feature-requests
  - Pin in #support: "For bug reports, use Report a Bug in the app"
- [x] **Create public `atriumn/idynic-feedback` repo** for bug reports (keeps code private, feedback public) - https://github.com/atriumn/idynic-feedback
- [ ] **Set up GitHub→Discord webhook** for bug notifications - Discord Server Settings → Integrations → GitHub, subscribe to `atriumn/idynic-feedback` issues
- [x] **Build in-app bug reporter** - "Report a Bug" button that:
  - Collects: title, description, optional screenshot, user email (if logged in)
  - Auto-includes: browser/device info, current URL
  - Creates GitHub issue in `idynic-feedback` repo via API
  - Labels as `bug` automatically
- [x] **Verify Sentry alerts are configured** - check you're getting email notifications on errors
- [ ] **Set up Axiom logging** - deferred, see `docs/plans/axiom-setup.md`

---

## Soon After Launch (Week 1-2)

### Security Hardening
- [ ] Fix function `search_path` warnings (16 functions) - create migration to set `search_path = ''`
- [ ] Move `vector` extension from public schema to `extensions` schema

### Data Management
- [ ] **Build "Delete My Account" feature** - user-facing button that:
  - Deletes all user data across all tables (profiles, identity_claims, evidence, claim_evidence, work_history, documents, opportunities, tailored_profiles, shared_links, matches, api_keys, usage_tracking, subscriptions, opportunity_notes, document_jobs)
  - Deletes storage files (resume PDFs)
  - Deletes Supabase Auth user record
  - Cancels Stripe subscription if active
- [ ] **Build "Export My Data" feature** - GDPR data portability requirement:
  - Export all user data as JSON + original uploaded files (PDFs)
  - Include: profile, work_history, identity_claims, evidence, opportunities, tailored_profiles
  - Deliver as ZIP download or email link for large exports

### Legal Hardening
- [x] **Add data retention section to Privacy Policy** - Added section 7 with account/professional/usage data retention periods
- [x] **Specify jurisdiction in ToS** - Set to State of Delaware, United States
- [x] **Add warranty disclaimer to ToS** - Added section 7 with "AS IS" / "AS AVAILABLE" language
- [x] **Add cookie consent banner** - Added CookieConsent component with accept/decline, stores in localStorage

### Operational
- [ ] Set up monthly manual backup to S3 (optional safety net beyond 7 days)
- [ ] Document environment variables needed for deployment (for bus factor)

---

## Post-Beta / As Needed

### When You Have Paying Customers
- [ ] Add status page (BetterStack or Instatus)
- [ ] Consider PITR add-on if RPO < 24h becomes important ($100/mo)
- [ ] Add uptime SLA commitments to Terms of Service

### User Experience - Onboarding
- [ ] **Create shared onboarding content** - `packages/shared/src/content/onboarding.ts` with prompt copy
- [ ] **Create shared onboarding hook** - `packages/shared/src/hooks/useOnboardingProgress.ts`
  - Track milestones: `resume_uploaded`, `story_added`, `opportunity_added`, `profile_tailored`
  - Accept storage adapter (localStorage for web, AsyncStorage for mobile)
- [ ] **Web: Add OnboardingPrompt component** - use existing toast system
- [ ] **Mobile: Add OnboardingPrompt component** - React Native toast or bottom sheet
- [ ] **Wire up trigger points:**
  - After resume upload → "Explore your claims or add an opportunity"
  - After story added → "Add more stories or upload a resume"
  - After opportunity added → "Try tailoring to see your match"
  - After profile tailored → "Share with a recruiter or download PDF"
- [ ] In-app help/documentation (future)

### I18n Architectural Prep
- [ ] **Create `lib/format.ts` utility** - centralize date/number/currency formatting using Intl APIs (~30 min)
- [ ] **Adopt UI string constant pattern** - for new code only, extract strings to component-level constants
- [ ] (No action needed for AI content - handled via prompts when needed)

---

## Reference: Current Infrastructure

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Supabase | Free → Pro | $0 → $25 |
| Vercel | Free/Pro | $0-20 |
| Sentry | Free tier | $0 |
| Axiom | Free tier | $0 |
| Stripe | Pay as you go | 2.9% + $0.30/txn |
| UptimeRobot | Free tier | $0 |
| Support (Crisp/Discord) | Free tier | $0 |

**Estimated monthly cost at beta launch: ~$25-45**

---

## Quick Reference: Key URLs

- Supabase Dashboard: https://supabase.com/dashboard
- Sentry: https://sentry.io
- Axiom: https://axiom.co
- UptimeRobot: https://uptimerobot.com
- Vercel: https://vercel.com

---

## Decisions Made

1. **Backups**: Supabase Pro daily backups sufficient for beta (7-day retention)
2. **Storage backups**: Not critical - extracted claims/evidence are what matter, users can re-upload
3. **Status page**: Skip for beta, add when paying customers expect it
4. **Support channel**: Discord for community + support (free, builds community)
5. **Bug reporting**: In-app reporter → public GitHub `idynic-feedback` repo (free, 2-way comms via public issues)
6. **2-way communication**: Users can follow their GitHub issue for updates; optionally capture email for direct follow-up
7. **GDPR**: Privacy policy covers it; deletion requests handled manually until feature built
8. **Monitoring**: UptimeRobot (free) + Sentry email alerts; upgrade to Sentry Team ($29/mo) for Discord webhooks later
9. **I18n**: No full i18n for beta; adopt conventions (string constants, Intl APIs) to ease future localization
10. **UI string retrofit**: Don't retrofit existing ~154 strings; apply pattern to new code only
11. **Onboarding**: Lightweight "next steps" prompts (not full wizard); shared logic for web + mobile via `@idynic/shared`

---

## Bug Reporter Implementation Notes

**API Route:** `POST /api/feedback`
- Accepts: `{ title, description, screenshot?, email? }`
- Auto-attaches: browser info, URL, user ID (if authenticated)
- Creates issue via GitHub API in `atriumn/idynic-feedback`
- Requires: `GITHUB_FEEDBACK_TOKEN` env var with `issues:write` scope

**UI Placement:**
- Footer link: "Report a Bug"
- Settings page: feedback section
- Optional: floating button or help menu

**Public Feedback Repo Structure:**
- Labels: `bug`, `feature-request`, `question`
- Issue template for consistent formatting
- Link back to private repo issues when needed (for internal tracking)

---

## Onboarding Implementation Notes

**Architecture:**
```
packages/shared/src/
├── content/
│   └── onboarding.ts       # Prompt copy for each milestone
└── hooks/
    └── useOnboardingProgress.ts  # Milestone tracking logic
```

**Milestone Triggers:**

| Milestone | Trigger Location | Prompt |
|-----------|------------------|--------|
| `resume_uploaded` | After resume extraction completes | "Your identity is taking shape! Explore your claims below, or add an opportunity to see how you match." |
| `story_added` | After story save | "Great story! We extracted [N] claims. Add more stories or upload a resume to build a fuller picture." |
| `opportunity_added` | After opportunity save | "Ready to tailor? Click any opportunity to generate a custom profile matched to the role." |
| `profile_tailored` | After tailored profile generated | "Your tailored profile is ready. Share it with a recruiter or download as PDF." |

**Storage Abstraction:**
```typescript
interface OnboardingStorage {
  getMilestone(key: string): Promise<boolean>;
  setMilestone(key: string): Promise<void>;
}

// Web: localStorage adapter
// Mobile: AsyncStorage adapter
```

**UI Behavior:**
- Prompts persist until dismissed (not auto-dismiss)
- Include action button linking to suggested next step
- Only show each prompt once per user (tracked via storage)
