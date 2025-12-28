# Android CI/CD Setup

**Status:** In Progress (Blocked on DUNS number for Play Store account)
**Date:** 2025-12-26
**Last Reviewed:** 2025-12-28

## Overview

Setting up GitHub Actions workflow for Android builds and Play Store deployment, matching the existing iOS workflow pattern.

## Progress

### Completed

#### 1. Release Keystore Created
- Generated `idynic-release.keystore` with alias `idynic`
- Keystore stored securely (not in repo)
- Valid for 10,000 days

#### 2. GitHub Secrets Configured
| Secret | Status |
|--------|--------|
| `ANDROID_KEYSTORE` | Set (base64-encoded keystore) |
| `ANDROID_KEYSTORE_PASSWORD` | Set |
| `ANDROID_KEY_ALIAS` | Set (`idynic`) |
| `ANDROID_KEY_PASSWORD` | Set |
| `PLAY_STORE_SERVICE_ACCOUNT_JSON` | Not set (waiting for Play Store account) |

#### 3. GitHub Actions Workflow Updated
Added `build-android` job to `.github/workflows/mobile-deploy.yml`:

- **Triggers:** Same as iOS (`mobile-v*` tags or manual dispatch)
- **Runner:** `ubuntu-latest` (faster/cheaper than macOS)
- **Build steps:**
  1. Checkout code
  2. Setup pnpm, Node 20, JDK 17
  3. Install dependencies
  4. Run `expo prebuild --platform android`
  5. Decode keystore from secret
  6. Build signed AAB with Gradle
  7. Upload AAB artifact

**Commit:** `620f349` - feat: add Android build to mobile deploy workflow

### Blocked

#### 4. Google Play Console Setup
**Blocker:** Waiting for DUNS number to create Google Play Developer account

Once DUNS is approved:
1. Create Google Play Developer account ($25 one-time fee)
2. Create app listing for `com.atriumn.idynic`
3. Set up service account for API access:
   - Create service account in Google Cloud Console
   - Download JSON key
   - Link to Play Console with release permissions
   - Add `PLAY_STORE_SERVICE_ACCOUNT_JSON` secret to GitHub

#### 5. First Manual Upload
**Blocker:** Requires Play Store account

Play Store API requires at least one manual upload before automated deploys work:
1. Build AAB locally or download from GitHub Actions artifact
2. Upload to Play Console Internal Testing track
3. Complete store listing requirements

#### 6. Auto-Deploy to Play Store
**Blocker:** Requires steps 4 and 5

Add to workflow:
```yaml
- name: Upload to Play Store
  uses: r0adkll/upload-google-play@v1
  with:
    serviceAccountJsonPlainText: ${{ secrets.PLAY_STORE_SERVICE_ACCOUNT_JSON }}
    packageName: com.atriumn.idynic
    releaseFiles: android/app/build/outputs/bundle/release/app-release.aab
    track: internal  # or 'production' for release lane
```

## Current Capabilities

**What works now:**
- Push `mobile-v*` tag → iOS and Android build in parallel
- Manual workflow dispatch → choose beta/release lane
- Download signed AAB from GitHub Actions artifacts
- Manual upload to Play Store (once account exists)

**What doesn't work yet:**
- Automatic Play Store uploads (waiting for service account)

## Files Modified

- `.github/workflows/mobile-deploy.yml` - Added `build-android` job

## Next Steps

1. Wait for DUNS number approval
2. Create Google Play Developer account
3. Complete steps 4-6 above
4. Test full pipeline with `mobile-v1.0.0` tag

## Commands Reference

### Build locally
```bash
cd apps/mobile
npx expo prebuild --platform android --clean
cd android
./gradlew bundleRelease
```

### Trigger workflow
```bash
# Via tag
git tag mobile-v1.0.0
git push --tags

# Via manual dispatch
gh workflow run mobile-deploy.yml -f lane=beta
```

### Add remaining secret (once Play Store account exists)
```bash
base64 -i service-account.json | gh secret set PLAY_STORE_SERVICE_ACCOUNT_JSON -R atriumn/idynic
```
