# Android Launch Plan

**Date:** 2025-12-23
**Status:** In Progress
**Goal:** Get the existing Expo/React Native app running on Android and distributed via Google Play Store

## Progress (Last reviewed: 2025-12-25)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Local Build & Smoke Test | ⏳ Not Started | Waiting to start |
| Phase 2: Fix & Polish | ⏳ Not Started | |
| Phase 3: Internal Distribution (APK) | ⏳ Not Started | |
| Phase 4: Google Play Internal Testing | ⏳ Not Started | |
| Phase 5: CI/CD Automation | ⏳ Not Started | |
| Phase 6: Production Release | ⏳ Not Started | |

### Notes
- Plan created 2025-12-23 (commit `a17eadab`)
- Mobile CI/CD workflow already exists for iOS (`mobile-deploy.yml`)
- Cross-platform codebase ready for Android builds

## Context

The Idynic mobile app is built with Expo SDK 54 / React Native 0.81.5. The codebase is already cross-platform - no platform-specific code exists in the app. Android configuration exists in `app.json` but has never been built or tested.

### Current State

**Ready:**
- Cross-platform codebase (no `.android.tsx` / `.ios.tsx` files in app)
- Android config in `app.json` (adaptive icon, edge-to-edge)
- Supabase auth via `expo-secure-store` (works on Android)
- Shared package for types and API client
- NativeWind/Tailwind styling (cross-platform)
- EAS project configured (project ID exists)
- Environment files (`.env.local`, `.env.production`)

**Needs work:**
- `app.json` Android background color is wrong (`#ffffff` should be `#0f172a`)
- `eas.json` has no Android build profiles
- CI/CD pipeline (`mobile-deploy.yml`) is iOS-only
- Never tested on Android device/emulator
- No Google Play Console account

### First Milestone

Core flow works on Android emulator:
- Login screen renders and authenticates
- Identity claims tab loads and displays data
- Opportunities tab loads and displays list
- Navigation works (tabs, back button)

---

## Phase 1: Local Build & Smoke Test

**Goal:** App launches on emulator, core flow works

### Step 1.1 - Fix app.json

Change Android adaptive icon background from `#ffffff` to `#0f172a`:

```json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/adaptive-icon.png",
    "backgroundColor": "#0f172a"
  }
}
```

### Step 1.2 - Generate Android project

```bash
cd apps/mobile
npx expo prebuild --platform android
```

Creates the `android/` directory with Gradle build files.

### Step 1.3 - Run on emulator

```bash
npx expo run:android
```

First build takes 5-10 minutes (Gradle downloads dependencies).

### Step 1.4 - Test core flow

Manual testing checklist:
- [ ] App launches without crash
- [ ] Login screen renders correctly
- [ ] Can enter credentials and authenticate
- [ ] Identity claims tab loads and displays data
- [ ] Opportunities tab loads and displays list
- [ ] Can tap into opportunity detail view
- [ ] Navigation (tabs, back button) works

### Expected Issues

- Font rendering differences
- Safe area / notch handling
- Keyboard behavior on forms
- Touch target sizes (Android has different defaults)

---

## Phase 2: Fix & Polish

**Goal:** Address Android-specific issues found during testing

### Step 2.1 - Triage issues

After Phase 1 testing, categorize:
- **Blockers:** Crashes, auth failures, data not loading
- **UX issues:** Visual glitches, layout problems, touch issues
- **Minor:** Cosmetic differences that can wait

### Step 2.2 - Common Android fixes

**SecureStore 2KB limit**

The code has a TODO noting this. Supabase JWTs can exceed 2KB. Options:
- Use `expo-sqlite` for token storage (chunked storage)
- Use `@react-native-async-storage/async-storage` (less secure but simpler)
- Implement LargeSecureStore pattern from Supabase docs

**Status bar / navigation bar**

`edgeToEdgeEnabled: true` means content can render behind system bars. May need `SafeAreaView` adjustments.

**Back button behavior**

Android hardware/gesture back button. Expo Router handles this, but verify back navigation makes sense on each screen.

**Keyboard handling**

Android keyboards vary more than iOS. Test that forms scroll properly when keyboard appears.

### Step 2.3 - Platform-specific code (if needed)

```typescript
import { Platform } from 'react-native';
const isAndroid = Platform.OS === 'android';
```

Or use file extensions: `Component.android.tsx` / `Component.ios.tsx`

---

## Phase 3: Internal Distribution (APK)

**Goal:** Shareable APK files for testers, built locally (no EAS cloud costs)

### Step 3.1 - Build APK locally

After `expo prebuild --platform android`:

```bash
cd apps/mobile/android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### Step 3.2 - Create build script

Create `scripts/build-android.sh` similar to `build-ios.sh`:
- Handles environment switching (dev/prod)
- Runs `expo prebuild --platform android`
- Builds APK or AAB (App Bundle)
- Signs with debug or release keystore

### Step 3.3 - Signing for distribution

For internal testing: Debug keystore works (auto-generated)

For Play Store later, create a release keystore:

```bash
keytool -genkey -v -keystore idynic-release.keystore \
  -alias idynic -keyalg RSA -keysize 2048 -validity 10000
```

Store securely - same key required for all future updates.

### Step 3.4 - Distribute APK

- Share via Google Drive / Dropbox / Slack
- Testers enable "Install unknown apps" and install directly

---

## Phase 4: Google Play Internal Testing

**Goal:** Set up Play Console, upload to internal testing track

### Step 4.1 - Create Google Play Console account

- Go to https://play.google.com/console
- Pay $25 one-time registration fee
- Complete identity verification (can take 24-48 hours)

### Step 4.2 - Create app listing

Minimal requirements for internal testing:
- App name: "Idynic"
- Default language
- App type: App (not game)
- Free or paid
- Privacy policy URL

Screenshots and descriptions are NOT required for internal testing.

### Step 4.3 - Set up app signing

Google Play App Signing (recommended):
- Google manages your upload key
- You sign with an upload key, Google re-signs for distribution
- Protects against losing your keystore

### Step 4.4 - Upload to Internal Testing track

Build an AAB instead of APK:

```bash
cd apps/mobile/android
./gradlew bundleRelease
```

Upload via Play Console → Internal testing → Create release

### Step 4.5 - Add testers

- Add email addresses (up to 100 internal testers)
- Testers get a private Play Store link
- Installs like a normal app (no "unknown sources" needed)

---

## Phase 5: CI/CD Automation

**Goal:** Add Android builds to GitHub Actions

### Step 5.1 - Update mobile-deploy.yml

Add a `build-android` job alongside `build-ios`:

```yaml
build-android:
  runs-on: ubuntu-latest
  timeout-minutes: 45
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'
    - uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '17'
    - name: Install dependencies
      run: pnpm install
    - name: Generate native project
      working-directory: apps/mobile
      run: npx expo prebuild --platform android --clean
    - name: Build AAB
      working-directory: apps/mobile/android
      run: ./gradlew bundleRelease
    - uses: actions/upload-artifact@v4
      with:
        name: app-release.aab
        path: apps/mobile/android/app/build/outputs/bundle/release/
```

Key differences from iOS:
- Runs on `ubuntu-latest` (free, faster) instead of `macos-15`
- Uses Java 17 (required for Gradle)
- Simpler signing than iOS

### Step 5.2 - Add signing secrets

Store in GitHub Secrets:
- `ANDROID_KEYSTORE_BASE64` - Base64-encoded keystore file
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

### Step 5.3 - Optional: Auto-upload to Play Store

Use `r0adkll/upload-google-play` action to push to internal testing on tag push.

---

## Phase 6: Production Release

**Goal:** Full Play Store listing and public availability

### Step 6.1 - Complete store listing

Required assets:
- **App icon:** 512x512 PNG (already exists)
- **Feature graphic:** 1024x500 PNG (banner for store page)
- **Screenshots:** Min 2, recommended 4-8 per device type
  - Phone: 16:9 or 9:16 aspect ratio
  - Tablet: Optional but recommended
- **Short description:** 80 characters max
- **Full description:** 4000 characters max

### Step 6.2 - Content rating

Complete the IARC questionnaire:
- Questions about violence, language, user content, etc.
- Idynic is likely "Everyone" rating
- Takes ~10 minutes

### Step 6.3 - Data safety form

Declare what data is collected:
- Account info (email, name)
- Profile data (work history, skills)
- Analytics (if any)
- How it's used, shared, secured

Similar to iOS App Privacy labels.

### Step 6.4 - Review & launch

- Submit for review (typically 1-3 days)
- Once approved, choose rollout percentage (start with 20%, then 100%)
- Monitor crash reports in Play Console

---

## Summary

| Phase | Goal | Dependencies |
|-------|------|--------------|
| 1. Local Build | App runs on emulator | None |
| 2. Fix & Polish | Android issues resolved | Phase 1 |
| 3. Internal APK | Shareable builds | Phase 2 |
| 4. Play Internal | Easier tester distribution | Phase 3 + $25 |
| 5. CI/CD | Automated builds | Phase 4 |
| 6. Production | Public release | Phase 5 |

**Critical path:** Phases 1-3 require zero external dependencies. Phase 4+ requires Google Play Console.

**Biggest unknowns:**
- Will the app work on first Android build? (Likely yes)
- SecureStore 2KB limit - may need addressing
- Visual quirks from iOS assumptions in UI code
