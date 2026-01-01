# Onboarding Prompts Design

> Created 2026-01-01 - Lightweight "next steps" prompts for new users

## Problem Statement

New users complete an action (upload resume, add story, add opportunity) but don't know what to do next. The empty state guides them to start, but there's no guidance after each milestone to keep them progressing toward value (seeing a tailored profile).

## Goals

1. Guide users through the "aha moment" journey: Resume/Story → Claims → Opportunity → Tailored Profile → Share
2. Show prompts that persist until dismissed (not auto-dismiss)
3. Each prompt shown only once per user per milestone
4. Shared logic for web + mobile, platform-specific UI

## Non-Goals

- Full onboarding wizard/tour
- Progress bar or completion percentage
- Gamification (badges, streaks)
- Push notifications

---

## Architecture

### 1. Milestone State Machine

Users progress through milestones linearly. We track which milestones have been achieved and which prompts have been dismissed.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  resume_uploaded │────▶│   story_added   │────▶│opportunity_added│────▶│ profile_tailored│
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
   "Explore claims      "Add more stories      "Try tailoring to     "Share with a
    or add opportunity"  or upload resume"      see your match"       recruiter"
```

### 2. Storage Schema

```typescript
interface OnboardingState {
  // Which prompts the user has dismissed
  dismissed: {
    after_resume_upload?: boolean;
    after_story_added?: boolean;
    after_opportunity_added?: boolean;
    after_profile_tailored?: boolean;
  };
  // Timestamp of last update (for debugging/analytics)
  updatedAt: string;
}
```

Storage key: `idynic_onboarding`

### 3. Package Structure

```
packages/shared/src/
├── content/
│   ├── index.ts              # Existing content (EMPTY_STATE, HELP_DOCS)
│   └── onboarding.ts         # NEW: Prompt copy for each milestone
└── hooks/
    └── useOnboardingProgress.ts  # NEW: Milestone tracking logic
```

---

## Content Definition

```typescript
// packages/shared/src/content/onboarding.ts

export const ONBOARDING_PROMPTS = {
  after_resume_upload: {
    title: "Resume processed!",
    message: "We found claims about your skills and experience. Explore them now, or add an opportunity to see how you match.",
    primaryAction: {
      label: "Explore Claims",
      route: "/identity",
    },
    secondaryAction: {
      label: "Add Opportunity",
      route: "/add-opportunity", // mobile route
      webRoute: "/opportunities", // web opens modal
    },
  },
  after_story_added: {
    title: "Story added!",
    message: "Your claims are getting stronger. Add more stories to boost confidence, or upload a resume for more evidence.",
    primaryAction: {
      label: "Add Another Story",
      route: "/add-story",
    },
    secondaryAction: {
      label: "Upload Resume",
      route: "/upload-resume",
    },
  },
  after_opportunity_added: {
    title: "Opportunity tracked!",
    message: "Generate a tailored profile to see how your experience aligns with this role.",
    primaryAction: {
      label: "Generate Profile",
      route: null, // Action happens in-context, not navigation
      action: "generate_tailored_profile",
    },
  },
  after_profile_tailored: {
    title: "Profile ready!",
    message: "Share your tailored profile with a recruiter, or download as PDF.",
    primaryAction: {
      label: "Share Profile",
      action: "share_profile",
    },
    secondaryAction: {
      label: "Download PDF",
      action: "download_pdf",
    },
  },
} as const;

export type OnboardingPromptKey = keyof typeof ONBOARDING_PROMPTS;
```

---

## Shared Hook

```typescript
// packages/shared/src/hooks/useOnboardingProgress.ts

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface OnboardingState {
  dismissed: Partial<Record<OnboardingPromptKey, boolean>>;
  updatedAt: string;
}

const STORAGE_KEY = "idynic_onboarding";

export function useOnboardingProgress(storage: StorageAdapter) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load state on mount
  useEffect(() => {
    storage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setState(JSON.parse(raw));
        } catch {
          setState({ dismissed: {}, updatedAt: new Date().toISOString() });
        }
      } else {
        setState({ dismissed: {}, updatedAt: new Date().toISOString() });
      }
      setIsLoading(false);
    });
  }, [storage]);

  // Check if a prompt should be shown
  const shouldShowPrompt = useCallback(
    (key: OnboardingPromptKey): boolean => {
      if (!state) return false;
      return !state.dismissed[key];
    },
    [state]
  );

  // Dismiss a prompt (persists to storage)
  const dismissPrompt = useCallback(
    async (key: OnboardingPromptKey) => {
      if (!state) return;
      const newState: OnboardingState = {
        dismissed: { ...state.dismissed, [key]: true },
        updatedAt: new Date().toISOString(),
      };
      setState(newState);
      await storage.setItem(STORAGE_KEY, JSON.stringify(newState));
    },
    [state, storage]
  );

  // Get the prompt content if it should be shown
  const getPrompt = useCallback(
    (key: OnboardingPromptKey) => {
      if (!shouldShowPrompt(key)) return null;
      return ONBOARDING_PROMPTS[key];
    },
    [shouldShowPrompt]
  );

  return {
    isLoading,
    shouldShowPrompt,
    dismissPrompt,
    getPrompt,
  };
}
```

---

## Web Implementation

### Storage Adapter

```typescript
// apps/web/src/lib/storage-adapter.ts
export const webStorageAdapter = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) => localStorage.setItem(key, value),
};
```

### OnboardingPrompt Component

Uses the existing toast system with custom styling:

```tsx
// apps/web/src/components/onboarding-prompt.tsx
"use client";

import { useOnboardingProgress, OnboardingPromptKey, ONBOARDING_PROMPTS } from "@idynic/shared";
import { webStorageAdapter } from "@/lib/storage-adapter";
import { useRouter } from "next/navigation";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingPromptProps {
  promptKey: OnboardingPromptKey;
  onAction?: (action: string) => void; // For in-context actions like "generate_tailored_profile"
}

export function OnboardingPrompt({ promptKey, onAction }: OnboardingPromptProps) {
  const router = useRouter();
  const { getPrompt, dismissPrompt, isLoading } = useOnboardingProgress(webStorageAdapter);

  const prompt = getPrompt(promptKey);

  if (isLoading || !prompt) return null;

  const handlePrimaryClick = () => {
    if (prompt.primaryAction.action) {
      onAction?.(prompt.primaryAction.action);
    } else if (prompt.primaryAction.route) {
      router.push(prompt.primaryAction.webRoute || prompt.primaryAction.route);
    }
    dismissPrompt(promptKey);
  };

  const handleSecondaryClick = () => {
    if (prompt.secondaryAction?.action) {
      onAction?.(prompt.secondaryAction.action);
    } else if (prompt.secondaryAction?.route) {
      router.push(prompt.secondaryAction.webRoute || prompt.secondaryAction.route);
    }
    dismissPrompt(promptKey);
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-card border border-border rounded-xl shadow-lg p-4 z-50 animate-in slide-in-from-bottom-4">
      <button
        onClick={() => dismissPrompt(promptKey)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <h3 className="font-semibold text-foreground mb-1">{prompt.title}</h3>
      <p className="text-sm text-muted-foreground mb-3">{prompt.message}</p>

      <div className="flex gap-2">
        <Button size="sm" onClick={handlePrimaryClick}>
          {prompt.primaryAction.label}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
        {prompt.secondaryAction && (
          <Button size="sm" variant="outline" onClick={handleSecondaryClick}>
            {prompt.secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
```

### Integration Points

**After resume upload** (`apps/web/src/components/upload-resume-modal.tsx`):

```tsx
// In the success handler, after mutation succeeds:
const handleUploadComplete = () => {
  // existing: invalidate queries, close modal
  // NEW: Show onboarding prompt
  setShowOnboardingPrompt("after_resume_upload");
};

// In the component:
{showOnboardingPrompt === "after_resume_upload" && (
  <OnboardingPrompt promptKey="after_resume_upload" />
)}
```

**After story added** (`apps/web/src/components/add-story-modal.tsx`):
```tsx
// Same pattern as resume
```

**After opportunity added** - triggers automatically when user lands on opportunity detail page without a tailored profile.

**After profile tailored** (`apps/web/src/app/opportunities/[id]/page.tsx`):
```tsx
// After useTailoredProfile returns a profile that was just generated
useEffect(() => {
  if (tailoredProfile && !previousTailoredProfile) {
    setShowOnboardingPrompt("after_profile_tailored");
  }
}, [tailoredProfile]);
```

---

## Mobile Implementation

### Storage Adapter

```typescript
// apps/mobile/lib/storage-adapter.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const mobileStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};
```

### OnboardingPrompt Component

Use a bottom sheet or toast-like component:

```tsx
// apps/mobile/components/onboarding-prompt.tsx
import { View, Text, Pressable, Animated } from "react-native";
import { X, ArrowRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useOnboardingProgress, OnboardingPromptKey, ONBOARDING_PROMPTS } from "@idynic/shared";
import { mobileStorageAdapter } from "../lib/storage-adapter";

interface OnboardingPromptProps {
  promptKey: OnboardingPromptKey;
  onAction?: (action: string) => void;
}

export function OnboardingPrompt({ promptKey, onAction }: OnboardingPromptProps) {
  const router = useRouter();
  const { getPrompt, dismissPrompt, isLoading } = useOnboardingProgress(mobileStorageAdapter);

  const prompt = getPrompt(promptKey);

  if (isLoading || !prompt) return null;

  const handlePrimaryClick = () => {
    if (prompt.primaryAction.action) {
      onAction?.(prompt.primaryAction.action);
    } else if (prompt.primaryAction.route) {
      router.push(prompt.primaryAction.route);
    }
    dismissPrompt(promptKey);
  };

  return (
    <View className="absolute bottom-20 left-4 right-4 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg">
      <Pressable
        onPress={() => dismissPrompt(promptKey)}
        className="absolute top-2 right-2 p-1"
      >
        <X color="#94a3b8" size={18} />
      </Pressable>

      <Text className="text-white font-semibold mb-1">{prompt.title}</Text>
      <Text className="text-slate-400 text-sm mb-3">{prompt.message}</Text>

      <View className="flex-row gap-2">
        <Pressable
          onPress={handlePrimaryClick}
          className="flex-row items-center bg-teal-600 px-4 py-2 rounded-lg"
        >
          <Text className="text-white font-medium">{prompt.primaryAction.label}</Text>
          <ArrowRight color="white" size={16} className="ml-1" />
        </Pressable>
        {prompt.secondaryAction && (
          <Pressable
            onPress={() => {
              if (prompt.secondaryAction?.route) {
                router.push(prompt.secondaryAction.route);
              }
              dismissPrompt(promptKey);
            }}
            className="bg-slate-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-slate-300 font-medium">
              {prompt.secondaryAction.label}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
```

### Integration Points

**After resume upload** (`apps/mobile/app/(app)/upload-resume.tsx`):

```tsx
// Modify handleComplete to show prompt instead of immediate redirect:
const [showPrompt, setShowPrompt] = useState(false);

const handleComplete = () => {
  queryClient.invalidateQueries({ queryKey: ["identity-claims"] });
  queryClient.invalidateQueries({ queryKey: ["profile"] });
  setShowPrompt(true);
  // Don't auto-navigate - let prompt guide them
};

// In render:
{showPrompt && (
  <OnboardingPrompt
    promptKey="after_resume_upload"
    onDismiss={() => router.replace("/(app)")}
  />
)}
```

**After story added** - same pattern in `apps/mobile/app/(app)/add-story.tsx`

**After opportunity added** - show in `apps/mobile/app/(app)/opportunities/[id].tsx` when no tailored profile exists

**After profile tailored** - show in same file after profile is generated

---

## Implementation Plan

### Phase 1: Shared Foundation ✅ Complete (PR #79)
- [x] Create `packages/shared/src/content/onboarding.ts` with prompt copy
- [x] Create `packages/shared/src/hooks/useOnboardingProgress.ts` with storage adapter pattern
- [x] Export from `packages/shared/src/index.ts`
- [x] Add comprehensive unit tests (33 tests for content + hook)

### Phase 2: Web Integration
- [ ] Create `apps/web/src/lib/storage-adapter.ts`
- [ ] Create `apps/web/src/components/onboarding-prompt.tsx`
- [ ] Wire up trigger points:
  - [ ] upload-resume-modal.tsx
  - [ ] add-story-modal.tsx
  - [ ] opportunities/[id]/page.tsx (for tailoring prompts)

### Phase 3: Mobile Integration
- [ ] Create `apps/mobile/lib/storage-adapter.ts` with AsyncStorage
- [ ] Create `apps/mobile/components/onboarding-prompt.tsx`
- [ ] Wire up trigger points:
  - [ ] upload-resume.tsx
  - [ ] add-story.tsx
  - [ ] opportunities/[id].tsx

### Phase 4: Testing & Polish
- [ ] Manual test all 4 prompt scenarios on web
- [ ] Manual test all 4 prompt scenarios on mobile
- [ ] Verify prompts don't reappear after dismissal
- [ ] Verify prompts work correctly across sessions

---

## Open Questions

1. **Should prompts stack?** If a user uploads a resume and immediately adds a story, do both prompts show? Current design: show one at a time, most recent wins.

2. **Reset on logout?** Should onboarding state reset when user logs out? Current design: no, tied to localStorage which persists.

3. **Analytics?** Do we want to track prompt impressions and actions? Could add Posthog events later.

---

## Success Metrics

1. **Completion rate**: % of new users who complete all 4 milestones within 7 days
2. **Time to first tailored profile**: Average time from signup to first tailored profile
3. **Prompt engagement rate**: % of prompts that lead to the suggested action (vs dismiss)
