# Beta Launch Checklist

> Generated from brainstorming session on 2025-12-27

## Before Launch (Blocking)

### Data Safety
- [ ] **Upgrade to Supabase Pro** ($25/mo) - enables daily automated backups with 7-day retention
- [ ] Verify backup is working after upgrade (check Dashboard → Database → Backups)

### Security
- [ ] **Enable leaked password protection** - Supabase Dashboard → Authentication → Providers → Email → Enable "Leaked password protection" (2 min)
- [ ] Add RLS policy to `beta_codes` table (or confirm no policy is intentional)

### Compliance
- [x] Privacy Policy - exists at `/legal/privacy`
- [x] Terms of Service - exists at `/legal/terms`
- [x] Cookie Policy - exists at `/legal/cookies`
- [ ] **Add ToS/Privacy links to signup page** - "By signing up, you agree to our Terms and Privacy Policy"
- [ ] **Fix AI training clause in Privacy Policy** - Clarify we use OpenAI API but do NOT train models on user data
- [ ] **Add billing/subscription section to ToS** - Refund policy, auto-renewal, cancellation terms
- [ ] **Verify support@idynic.com is receiving emails** and someone is monitoring it

### Operational Readiness
- [ ] **Set up UptimeRobot** (free tier) - monitors for homepage + API health endpoint
- [ ] **Set up Discord server** for community + support:
  - Create channels: #announcements, #general, #support, #feature-requests
  - Add Ticket Tool bot for private support threads
  - Pin bug report template (redirects to in-app reporter)
- [ ] **Create public `atriumn/idynic-feedback` repo** for bug reports (keeps code private, feedback public)
- [ ] **Build in-app bug reporter** - "Report a Bug" button that:
  - Collects: title, description, optional screenshot, user email (if logged in)
  - Auto-includes: browser/device info, current URL
  - Creates GitHub issue in `idynic-feedback` repo via API
  - Labels as `bug` automatically
- [ ] **Verify Sentry alerts are configured** - check you're getting email notifications on errors
- [ ] **Verify Axiom is receiving logs** - check dashboard has recent data

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
- [ ] **Add data retention section to Privacy Policy** - State how long data is kept (e.g., "until you delete your account")
- [ ] **Specify jurisdiction in ToS** - Replace vague "jurisdiction in which Idynic operates" with specific state
- [ ] **Add warranty disclaimer to ToS** - "AS IS" / "AS AVAILABLE" language
- [ ] **Add cookie consent banner** - Required for EU users to opt-in to analytics cookies

### Operational
- [ ] Set up monthly manual backup to S3 (optional safety net beyond 7 days)
- [ ] Document environment variables needed for deployment (for bus factor)

---

## Post-Beta / As Needed

### When You Have Paying Customers
- [ ] Add status page (BetterStack or Instatus)
- [ ] Consider PITR add-on if RPO < 24h becomes important ($100/mo)
- [ ] Add uptime SLA commitments to Terms of Service

### User Experience
- [ ] User onboarding flow (to be designed separately)
- [ ] In-app help/documentation

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
