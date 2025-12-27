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
- [ ] **Verify support@idynic.com is receiving emails** and someone is monitoring it

### Operational Readiness
- [ ] **Set up UptimeRobot** (free tier) - monitors for homepage + API health
- [ ] **Set up support channel** - either Crisp (live chat + inbox) or Discord
- [ ] **Verify Sentry alerts are configured** - check you're getting notified on errors
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
4. **Support**: Start with Crisp or Discord, not heavyweight ticketing
5. **GDPR**: Privacy policy covers it; deletion requests handled manually until feature built
