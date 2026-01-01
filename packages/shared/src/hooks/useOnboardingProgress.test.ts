import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useOnboardingProgress,
  type StorageAdapter,
  type OnboardingState,
} from "./useOnboardingProgress";
import { ONBOARDING_STORAGE_KEY, ONBOARDING_PROMPTS } from "../content/onboarding";

// Mock storage adapter factory
function createMockStorage(initialValue: string | null = null): StorageAdapter & {
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  if (initialValue !== null) {
    store.set(ONBOARDING_STORAGE_KEY, initialValue);
  }

  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

describe("useOnboardingProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("starts in loading state", () => {
      const storage = createMockStorage();
      const { result } = renderHook(() => useOnboardingProgress(storage));

      // Initially loading
      expect(result.current.isLoading).toBe(true);
    });

    it("loads empty state when storage is empty", async () => {
      const storage = createMockStorage();
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(storage.getItem).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY);
      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(true);
    });

    it("loads existing state from storage", async () => {
      const existingState: OnboardingState = {
        dismissed: { after_resume_upload: true },
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      const storage = createMockStorage(JSON.stringify(existingState));
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(false);
      expect(result.current.shouldShowPrompt("after_story_added")).toBe(true);
    });

    it("handles invalid JSON in storage gracefully", async () => {
      const storage = createMockStorage("not valid json");
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to default state (all prompts visible)
      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(true);
    });

    it("handles malformed state object gracefully", async () => {
      const storage = createMockStorage(JSON.stringify({ foo: "bar" }));
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to default state
      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(true);
    });
  });

  describe("shouldShowPrompt", () => {
    it("returns true for non-dismissed prompts", async () => {
      const storage = createMockStorage();
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(true);
      expect(result.current.shouldShowPrompt("after_story_added")).toBe(true);
      expect(result.current.shouldShowPrompt("after_opportunity_added")).toBe(true);
      expect(result.current.shouldShowPrompt("after_profile_tailored")).toBe(true);
    });

    it("returns false for dismissed prompts", async () => {
      const existingState: OnboardingState = {
        dismissed: {
          after_resume_upload: true,
          after_opportunity_added: true,
        },
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      const storage = createMockStorage(JSON.stringify(existingState));
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(false);
      expect(result.current.shouldShowPrompt("after_story_added")).toBe(true);
      expect(result.current.shouldShowPrompt("after_opportunity_added")).toBe(false);
      expect(result.current.shouldShowPrompt("after_profile_tailored")).toBe(true);
    });

    it("returns false while loading", () => {
      const storage = createMockStorage();
      // Make getItem never resolve to keep in loading state
      storage.getItem = vi.fn((): Promise<string | null> => new Promise(() => {}));

      const { result } = renderHook(() => useOnboardingProgress(storage));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(false);
    });
  });

  describe("dismissPrompt", () => {
    it("dismisses a prompt and persists to storage", async () => {
      const storage = createMockStorage();
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Prompt should be visible initially
      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(true);

      // Dismiss the prompt
      await act(async () => {
        await result.current.dismissPrompt("after_resume_upload");
      });

      // Prompt should now be hidden
      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(false);

      // Should have persisted to storage
      expect(storage.setItem).toHaveBeenCalled();
      const savedState = JSON.parse(
        storage.store.get(ONBOARDING_STORAGE_KEY) ?? "{}"
      ) as OnboardingState;
      expect(savedState.dismissed.after_resume_upload).toBe(true);
      expect(savedState.updatedAt).toBeDefined();
    });

    it("preserves other dismissed prompts when dismissing new one", async () => {
      const existingState: OnboardingState = {
        dismissed: { after_resume_upload: true },
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      const storage = createMockStorage(JSON.stringify(existingState));
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Dismiss another prompt
      await act(async () => {
        await result.current.dismissPrompt("after_story_added");
      });

      // Both prompts should now be dismissed
      expect(result.current.shouldShowPrompt("after_resume_upload")).toBe(false);
      expect(result.current.shouldShowPrompt("after_story_added")).toBe(false);

      const savedState = JSON.parse(
        storage.store.get(ONBOARDING_STORAGE_KEY) ?? "{}"
      ) as OnboardingState;
      expect(savedState.dismissed.after_resume_upload).toBe(true);
      expect(savedState.dismissed.after_story_added).toBe(true);
    });

    it("does nothing while loading", async () => {
      const storage = createMockStorage();
      // Make getItem never resolve to keep in loading state
      storage.getItem = vi.fn((): Promise<string | null> => new Promise(() => {}));

      const { result } = renderHook(() => useOnboardingProgress(storage));

      await act(async () => {
        await result.current.dismissPrompt("after_resume_upload");
      });

      // Should not have called setItem
      expect(storage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("getPrompt", () => {
    it("returns prompt content for non-dismissed prompts", async () => {
      const storage = createMockStorage();
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const prompt = result.current.getPrompt("after_resume_upload");
      expect(prompt).toEqual(ONBOARDING_PROMPTS.after_resume_upload);
    });

    it("returns null for dismissed prompts", async () => {
      const existingState: OnboardingState = {
        dismissed: { after_resume_upload: true },
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      const storage = createMockStorage(JSON.stringify(existingState));
      const { result } = renderHook(() => useOnboardingProgress(storage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.getPrompt("after_resume_upload")).toBeNull();
      expect(result.current.getPrompt("after_story_added")).toEqual(
        ONBOARDING_PROMPTS.after_story_added
      );
    });

    it("returns null while loading", () => {
      const storage = createMockStorage();
      storage.getItem = vi.fn((): Promise<string | null> => new Promise(() => {}));

      const { result } = renderHook(() => useOnboardingProgress(storage));

      expect(result.current.getPrompt("after_resume_upload")).toBeNull();
    });
  });

  describe("persistence across sessions", () => {
    it("dismissed prompts survive storage reload", async () => {
      const storage = createMockStorage();
      const { result, unmount } = renderHook(() =>
        useOnboardingProgress(storage)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Dismiss a prompt
      await act(async () => {
        await result.current.dismissPrompt("after_resume_upload");
      });

      // Unmount the hook
      unmount();

      // Remount with the same storage (simulating page refresh)
      const { result: result2 } = renderHook(() =>
        useOnboardingProgress(storage)
      );

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Prompt should still be dismissed
      expect(result2.current.shouldShowPrompt("after_resume_upload")).toBe(false);
      expect(result2.current.shouldShowPrompt("after_story_added")).toBe(true);
    });
  });
});
