# Phase 4: Mobile App E2E Tests (Maestro)

**Priority**: HIGH
**Effort**: 3-4 days
**Status**: Not Started

## Progress (Last reviewed: 2025-12-29)

| Step | Status | Notes |
|------|--------|-------|
| Step 1-16: All steps | ⏳ Not Started | Blocked on Phase 2 (test data seeding utilities) |

### Drift Notes
- No implementation started yet
- Blocked on Phase 2 completion

## Overview

Add E2E tests for the React Native/Expo mobile app using Maestro. Tests run on iOS simulator and Android emulator, validating critical user flows on both platforms.

## Prerequisites

- [ ] Phase 2 complete (test data seeding utilities exist)
- [ ] Mobile app builds and runs locally
- [ ] iOS: Xcode installed, simulator available
- [ ] Android: Android Studio installed, emulator available
- [ ] E2E Supabase project exists (from Phase 2)

## Steps

### Step 1: Install Maestro CLI

**Effort**: 15 min

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"
maestro --version
```

Add to shell profile for persistence.

**Done when**: `maestro --version` returns version number

---

### Step 2: Create E2E Directory Structure

**Effort**: 15 min

```bash
mkdir -p apps/mobile/e2e/flows/auth
mkdir -p apps/mobile/e2e/flows/profile
mkdir -p apps/mobile/e2e/flows/opportunities
mkdir -p apps/mobile/e2e/flows/documents
mkdir -p apps/mobile/e2e/config
mkdir -p apps/mobile/e2e/scripts
```

**Done when**: Directories exist

---

### Step 3: Create Environment Config

**Effort**: 30 min

Create `apps/mobile/e2e/config/env.yaml`:

```yaml
E2E_SUPABASE_URL: ${E2E_SUPABASE_URL}
E2E_TEST_EMAIL: ${E2E_TEST_EMAIL}
E2E_TEST_PASSWORD: ${E2E_TEST_PASSWORD}
```

**Done when**: Config file created

---

### Step 4: Create Test Data Scripts

**Effort**: 1 hour

Create `apps/mobile/e2e/scripts/seed-data.sh`:
- Generate unique test run ID
- Call shared seeding utility (from web e2e)
- Export credentials as env vars

Create `apps/mobile/e2e/scripts/cleanup-data.sh`:
- Call shared cleanup utility

**Done when**: Scripts can seed and cleanup test data

---

### Step 5: Add testID Props to App Components

**Effort**: 2-3 hours

Audit mobile app and add `testID` props to key elements:
- Login form inputs: `testID="email-input"`, `testID="password-input"`
- Navigation tabs: `testID="tab-profile"`, `testID="tab-opportunities"`, etc.
- Buttons: `testID="login-button"`, `testID="save-button"`, etc.
- Lists: `testID="opportunity-list"`, `testID="opportunity-card-0"`, etc.

**Done when**: All interactive elements have testIDs

---

### Step 6: Write Auth Flow Tests

**Effort**: 1.5 hours

Create `apps/mobile/e2e/flows/auth/login.yaml`:
- Launch app with clear state
- Enter credentials
- Tap sign in
- Assert dashboard visible

Create `apps/mobile/e2e/flows/auth/signup.yaml`:
- Launch app
- Navigate to signup
- Fill registration form
- Assert onboarding starts

Create `apps/mobile/e2e/flows/auth/logout.yaml`:
- Navigate to settings
- Tap logout
- Assert login screen visible

**Done when**: Auth flows pass on simulator

---

### Step 7: Write Profile Flow Tests

**Effort**: 1.5 hours

Create `apps/mobile/e2e/flows/profile/view-profile.yaml`:
- Navigate to profile tab
- Assert profile data visible

Create `apps/mobile/e2e/flows/profile/edit-profile.yaml`:
- Navigate to profile
- Tap edit
- Modify headline
- Save
- Assert changes visible

**Done when**: Profile flows pass

---

### Step 8: Write Opportunity Flow Tests

**Effort**: 1 hour

Create `apps/mobile/e2e/flows/opportunities/view-matches.yaml`:
- Navigate to opportunities tab
- Assert list loads
- Tap first opportunity
- Assert detail view
- Navigate back

**Done when**: Opportunity flows pass

---

### Step 9: Write Document Flow Tests

**Effort**: 1 hour

Create `apps/mobile/e2e/flows/documents/view-resume.yaml`:
- Navigate to documents
- Tap resume
- Assert resume content visible

**Done when**: Document flows pass

---

### Step 10: Create Run Script

**Effort**: 30 min

Create `apps/mobile/e2e/scripts/run-e2e.sh`:

```bash
#!/bin/bash
set -e

# Seed data
source ./e2e/scripts/seed-data.sh

# Run Maestro
maestro test e2e/flows/ --format junit --output e2e-results.xml

# Cleanup
./e2e/scripts/cleanup-data.sh
```

**Done when**: `./e2e/scripts/run-e2e.sh` runs all flows

---

### Step 11: Test Locally on iOS

**Effort**: 1 hour

1. Build iOS debug app: `npx expo prebuild --platform ios`
2. Build in Xcode or with `xcodebuild`
3. Boot simulator
4. Install app
5. Run Maestro flows

**Done when**: All flows pass on iOS simulator

---

### Step 12: Test Locally on Android

**Effort**: 1 hour

1. Build Android debug app: `npx expo prebuild --platform android`
2. Build with `./gradlew assembleDebug`
3. Start emulator
4. Install APK
5. Run Maestro flows

**Done when**: All flows pass on Android emulator

---

### Step 13: Add Package.json Scripts

**Effort**: 15 min

Add to `apps/mobile/package.json`:

```json
{
  "scripts": {
    "test:e2e": "./e2e/scripts/run-e2e.sh",
    "test:e2e:ios": "maestro test e2e/flows/ --platform ios",
    "test:e2e:android": "maestro test e2e/flows/ --platform android"
  }
}
```

**Done when**: Scripts work

---

### Step 14: Create iOS CI Workflow

**Effort**: 2 hours

Create `.github/workflows/mobile-e2e.yml` with `e2e-ios` job:
- Runs on `macos-14` (M1)
- Install dependencies
- Install Maestro
- Build iOS app
- Boot simulator
- Seed test data
- Run Maestro flows
- Upload results
- Cleanup

**Done when**: iOS E2E runs in CI

---

### Step 15: Create Android CI Job

**Effort**: 2 hours

Add `e2e-android` job to `.github/workflows/mobile-e2e.yml`:
- Runs on `ubuntu-latest`
- Install dependencies
- Install Maestro
- Set up JDK 17
- Build Android app
- Use `android-emulator-runner` action
- Run flows inside emulator script

**Done when**: Android E2E runs in CI

---

### Step 16: Test Full CI Flow

**Effort**: 1 hour

1. Create test PR with mobile changes
2. Verify both iOS and Android jobs trigger
3. Verify tests run successfully
4. Check artifact uploads on failure

**Done when**: Full PR → E2E flow works for both platforms

---

## Acceptance Criteria

- [ ] `pnpm test:e2e` runs all mobile E2E tests locally
- [ ] Tests run on iOS simulator in CI
- [ ] Tests run on Android emulator in CI
- [ ] All critical flows covered (auth, profile, opportunities, documents)
- [ ] Test data seeded and cleaned up automatically
- [ ] Results uploaded as artifacts
- [ ] Total: 6 flows × 2 platforms = 12 test runs

## Dependencies

- Phase 2 (test data seeding utilities)
- E2E Supabase project
- Mobile app with testID props

## Outputs

- `apps/mobile/e2e/` directory with Maestro flows
- `.github/workflows/mobile-e2e.yml`
- Updated mobile app with testID props
