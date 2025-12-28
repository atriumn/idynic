# Chrome Extension Deployment Plan

## Overview

Deploy the Idynic Job Saver Chrome extension to the Google Chrome Web Store for public distribution.

**Current state:** Extension is functional, tested locally
**Target:** Published in Chrome Web Store, discoverable by users

---

## Cost Analysis (Resolved)

During brainstorming, we validated that auto-enrichment on save is cost-effective:

| Step | Cost per Job |
|------|--------------|
| LinkedIn scraping (BrightData) | $0.0015 |
| GPT extraction | $0.0003 |
| Embedding | $0.0001 |
| Company research | ~$0.005 |
| **Total enrichment** | **~$0.007** |

**Decision:** Keep current flow - Chrome extension saves trigger automatic enrichment, same as all other save methods. No deferred processing needed.

---

## Pre-Submission Checklist

### 1. Code Updates

- [ ] **Remove localhost from manifest.json**
  ```json
  // Change from:
  "host_permissions": [
    "https://idynic.com/*",
    "http://localhost:3000/*"
  ]

  // To:
  "host_permissions": [
    "https://idynic.com/*"
  ]
  ```

- [ ] **Verify API base URL** in `lib/api.js` defaults to production

- [ ] **Update version number** in manifest.json if needed (currently 1.0.0)

### 2. Assets Required

| Asset | Spec | Status |
|-------|------|--------|
| Icon 16x16 | PNG | Done: `icons/icon16.png` |
| Icon 48x48 | PNG | Done: `icons/icon48.png` |
| Icon 128x128 | PNG | Done: `icons/icon128.png` |
| Screenshots | 1280x800 or 640x400, 1-5 images | **TODO** |
| Promotional tile (small) | 440x280 PNG | Optional |
| Promotional tile (large) | 920x680 PNG | Optional |

### 3. Screenshots Needed

Create 2-3 screenshots showing:
1. Extension popup on a job posting page (ready state)
2. Success state after saving a job
3. Options page with API key configuration

### 4. Privacy Policy

**Required** because extension uses `storage` permission.

- [ ] Ensure privacy policy is published at `https://idynic.com/privacy`
- [ ] Privacy policy must mention:
  - What data the extension collects (URLs, job posting content)
  - How data is transmitted (to idynic.com API)
  - How data is stored (user's Idynic account)
  - No data sold to third parties

---

## Chrome Web Store Requirements

### Developer Account Setup

1. Go to https://chrome.google.com/webstore/devconsole/register
2. Sign in with **jeff@idynic.com**
3. Pay one-time $5 USD registration fee
4. Accept Developer Agreement

### Store Listing Information

Prepare the following:

**Short description** (up to 132 chars):
> Save jobs to Idynic with one click. Track opportunities and get AI-tailored resumes.

**Detailed description** (up to 16,000 chars):
```
Idynic Job Saver makes it easy to save job postings from any website directly to your Idynic account.

FEATURES:
- One-click save from any job posting page
- Automatic extraction of job title, company, and requirements
- Works with LinkedIn, Indeed, Greenhouse, Lever, and thousands of other job sites
- Seamless sync with your Idynic account

HOW IT WORKS:
1. Browse job postings on any website
2. Click the Idynic extension icon
3. Click "Save Job" to add it to your Idynic account
4. View saved jobs and generate tailored resumes at idynic.com

REQUIREMENTS:
- An Idynic account (free or paid)
- API key from your Idynic settings

PRIVACY:
This extension only activates when you click it. It sends the current page URL to Idynic's servers to extract job details. No browsing data is collected or shared. See our privacy policy for details.
```

**Category:** Productivity

**Language:** English

**Website:** https://idynic.com

**Privacy policy URL:** https://idynic.com/privacy

---

## Submission Process

### Step 1: Package the Extension

```bash
cd chrome-extension

# Create production build (remove any dev files)
zip -r idynic-job-saver.zip . \
  -x "*.DS_Store" \
  -x "*.git*" \
  -x "README.md"
```

### Step 2: Upload to Chrome Web Store

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload the ZIP file
4. Fill in store listing information (from above)
5. Upload screenshots
6. Set visibility: **Unlisted** (beta users only via direct link)
7. Set distribution regions: All regions

### Step 3: Submit for Review

1. Review all information
2. Click "Submit for Review"
3. Wait for Google's review (typically 1-3 business days)

### Step 4: Handle Review Feedback

Google may request:
- Clarification on permissions usage
- Privacy policy updates
- Screenshot changes
- Code modifications

Respond promptly to avoid delays.

---

## Post-Publication

### Monitoring

- [ ] Set up alerts for Chrome Web Store reviews
- [ ] Monitor error rates in extension (consider adding error reporting)
- [ ] Track installation metrics in Developer Dashboard

### Updates

To push updates:
1. Increment version in manifest.json
2. Create new ZIP
3. Upload in Developer Dashboard
4. Submit for review (updates usually faster than initial review)

### Marketing

- [ ] Add Chrome Web Store link to idynic.com
- [ ] Add installation instructions to user onboarding
- [ ] Consider "Install Extension" prompt for web app users

---

## Timeline

| Task | Owner | Est. Effort |
|------|-------|-------------|
| Code updates (remove localhost) | Dev | 15 min |
| Create screenshots | Design/Dev | 1 hour |
| Verify privacy policy | Legal/Product | 30 min |
| Developer account setup | Admin | 15 min |
| Write store listing | Product | 30 min |
| Package and submit | Dev | 30 min |
| **Total** | | **~3 hours** |

Review period: 1-3 business days after submission

---

## Decisions Made

- **Developer account:** jeff@idynic.com
- **Visibility:** Unlisted (switch to public at general launch)
- **Enrichment cost:** Absorb ~$0.007/job - no changes to current flow
- **Tier-gating:** None for beta - anyone with API key can use extension
