# Idynic Mobile App Design

**Status:** Done

## Progress (Last reviewed: 2025-12-24)

Design document fully implemented via `2024-12-23-mobile-app-implementation.md`. All architectural decisions were followed. iOS mobile app is live.

## Overview

React Native + Expo mobile app for idynic, providing full feature parity with the web application. iOS-first launch with Android support following.

## Decision Summary

| Factor | Decision |
|--------|----------|
| Framework | React Native + Expo SDK 52 |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind v4 (Tailwind) |
| Data fetching | React Query |
| Auth | Supabase JS + expo-secure-store |
| Push notifications | Expo Push Service |
| OTA updates | EAS Update |
| Platform priority | iOS first, Android later |

## Project Structure

Monorepo approach - add mobile app alongside existing web app:

```
idynic/
├── apps/
│   ├── web/              # Current Next.js app (moved)
│   └── mobile/           # New Expo app
├── packages/
│   ├── shared/           # Shared TypeScript code
│   │   ├── types/        # Supabase types, API types
│   │   ├── schemas/      # Zod validation schemas
│   │   └── api/          # Platform-agnostic API client
│   └── ui/               # (future) Shared component logic
├── chrome-extension/     # Unchanged
└── supabase/             # Unchanged
```

### Code Sharing

**Moves to `packages/shared`:**
- `src/lib/supabase/types.ts` → `packages/shared/types/database.ts`
- Zod schemas extracted from API routes
- Platform-agnostic API client (fetch-based)

**Tooling:**
- pnpm workspaces or Turborepo for monorepo management
- EAS Build for native builds
- EAS Update for OTA deployments

## Navigation Structure

```
apps/mobile/app/
├── (auth)/
│   ├── login.tsx
│   └── callback.tsx
├── (app)/                        # Authenticated routes
│   ├── _layout.tsx               # Tab navigator
│   ├── index.tsx                 # Home/Dashboard
│   ├── profile/
│   │   ├── index.tsx             # Profile overview
│   │   ├── edit.tsx              # Edit profile sections
│   │   └── identity.tsx          # Identity/skills graph
│   ├── opportunities/
│   │   ├── index.tsx             # List view
│   │   ├── [id].tsx              # Opportunity detail
│   │   └── add.tsx               # Add new opportunity
│   ├── shared-links/
│   │   └── index.tsx             # Manage shared links
│   └── settings/
│       ├── index.tsx
│       └── api-keys.tsx
└── _layout.tsx                   # Root layout (auth check)
```

### Screen Mapping

| Web Route | Mobile Screen | Notes |
|-----------|---------------|-------|
| `/` | Home tab | Dashboard summary |
| `/profile` | Profile tab | View/edit profile |
| `/identity` | Profile → Identity | Skills graph |
| `/opportunities` | Opportunities tab | List + detail views |
| `/shared-links` | Shared Links tab | Manage sharing |
| `/settings` | Settings tab | API keys, preferences |

**Bottom tabs:** Home, Profile, Opportunities, Settings

## Authentication

### Flow

```
App Start → Check Session → Auth State
                │                │
         No session?       Has session?
                ▼                ▼
         Login Screen       App Tabs
```

### Implementation

- Use `@supabase/supabase-js` directly (not SSR version)
- Store session in `expo-secure-store` (encrypted)
- OAuth via `expo-auth-session`
- Magic link auth supported

## Data Fetching

Shared API client pattern:

```typescript
// packages/shared/api/client.ts
export const apiClient = {
  profile: {
    get: () => fetch('/api/v1/profile').then(r => r.json()),
    update: (data) => fetch('/api/v1/profile', {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
  opportunities: {
    list: () => fetch('/api/v1/opportunities').then(r => r.json()),
  }
}
```

React Query for data management (same patterns as web):

```typescript
const { data: profile } = useQuery({
  queryKey: ['profile'],
  queryFn: apiClient.profile.get
})
```

React Query caching provides basic offline read support.

## Push Notifications

### Architecture

```
Supabase DB Trigger → Edge Function → Expo Push Service → Device
```

### Database Schema

```sql
create table user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null, -- 'ios' or 'android'
  created_at timestamptz default now(),
  unique(user_id, expo_push_token)
);
```

### Notification Types

- Opportunity match score ready
- Shared link was viewed
- Profile analysis complete
- (future) Recruiter messages

## Special Considerations

### Identity Graph (D3 Visualization)

- Use `react-native-svg` + `d3` (math only, not DOM manipulation)
- Alternative: `react-native-skia` for better performance
- Hook logic from `use-identity-graph.ts` is largely reusable
- Touch interactions: pinch-to-zoom, pan, tap nodes

### PDF Generation

- Web uses `@react-pdf/renderer`
- Mobile: Generate server-side via API endpoint, download to device
- Avoids slow on-device PDF generation

## Deployment

### Workflow

```
Code Push → GitHub → EAS Build → TestFlight/Play Console
                  ↓
            EAS Update (OTA)
                  ↓
         Live app updated (no review)
```

### Two Deployment Paths

1. **Native changes** (new Expo SDK, native modules) → Full App Store review
2. **JS-only changes** (features, fixes, UI) → OTA via EAS Update (instant)

### Release Channels

- Development builds for testing via EAS
- Preview channel for beta testers
- Production channel for App Store releases
- OTA updates target specific channels

## Future Considerations

- Deep OS integration (widgets, share extensions) - requires native modules
- Full offline-first support with sync
- Android launch

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Framework | React Native + Expo SDK 52 |
| Navigation | Expo Router |
| Styling | NativeWind v4 |
| State/Data | React Query |
| Auth | Supabase JS + expo-secure-store |
| Push | Expo Push Service |
| Graphics | react-native-svg + d3 |
| Build | EAS Build |
| Updates | EAS Update |
