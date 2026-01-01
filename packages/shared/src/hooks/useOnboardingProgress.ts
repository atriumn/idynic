import { useState, useEffect, useCallback } from "react";
import {
  ONBOARDING_PROMPTS,
  ONBOARDING_STORAGE_KEY,
  type OnboardingPromptKey,
} from "../content/onboarding";

/**
 * Interface for storage adapters to allow platform-specific storage implementations
 * - Web: localStorage wrapper
 * - Mobile: AsyncStorage wrapper
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * Persisted state for tracking which onboarding prompts have been dismissed
 */
export interface OnboardingState {
  /** Map of prompt keys to their dismissed status */
  dismissed: Partial<Record<OnboardingPromptKey, boolean>>;
  /** ISO timestamp of last state update (for debugging/analytics) */
  updatedAt: string;
}

const DEFAULT_STATE: OnboardingState = {
  dismissed: {},
  updatedAt: new Date().toISOString(),
};

/**
 * Hook for managing onboarding prompt visibility and dismissal
 *
 * Provides platform-agnostic onboarding state management that persists
 * dismissed prompts to storage.
 *
 * @param storage - Platform-specific storage adapter
 * @returns Object with loading state and prompt management functions
 *
 * @example
 * ```tsx
 * // Web usage with localStorage
 * const webAdapter = {
 *   getItem: async (key) => localStorage.getItem(key),
 *   setItem: async (key, value) => localStorage.setItem(key, value),
 * };
 *
 * function MyComponent() {
 *   const { isLoading, shouldShowPrompt, dismissPrompt, getPrompt } =
 *     useOnboardingProgress(webAdapter);
 *
 *   if (isLoading) return null;
 *
 *   const prompt = getPrompt('after_resume_upload');
 *   if (!prompt) return null;
 *
 *   return (
 *     <div>
 *       <h3>{prompt.title}</h3>
 *       <p>{prompt.message}</p>
 *       <button onClick={() => dismissPrompt('after_resume_upload')}>
 *         Dismiss
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOnboardingProgress(storage: StorageAdapter) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load state from storage on mount
  useEffect(() => {
    let mounted = true;

    storage.getItem(ONBOARDING_STORAGE_KEY).then((raw) => {
      if (!mounted) return;

      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // Validate the parsed state has the expected shape
          if (parsed && typeof parsed.dismissed === "object") {
            setState(parsed as OnboardingState);
          } else {
            setState(DEFAULT_STATE);
          }
        } catch {
          // Invalid JSON, start fresh
          setState(DEFAULT_STATE);
        }
      } else {
        setState(DEFAULT_STATE);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [storage]);

  /**
   * Check if a specific prompt should be shown (i.e., has not been dismissed)
   */
  const shouldShowPrompt = useCallback(
    (key: OnboardingPromptKey): boolean => {
      if (!state) return false;
      return !state.dismissed[key];
    },
    [state]
  );

  /**
   * Dismiss a prompt permanently (persists to storage)
   * Once dismissed, the prompt will never show again for this user
   */
  const dismissPrompt = useCallback(
    async (key: OnboardingPromptKey): Promise<void> => {
      if (!state) return;

      const newState: OnboardingState = {
        dismissed: { ...state.dismissed, [key]: true },
        updatedAt: new Date().toISOString(),
      };

      setState(newState);
      await storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(newState));
    },
    [state, storage]
  );

  /**
   * Get the prompt content if it should be shown, or null if dismissed
   */
  const getPrompt = useCallback(
    (key: OnboardingPromptKey) => {
      if (!shouldShowPrompt(key)) return null;
      return ONBOARDING_PROMPTS[key];
    },
    [shouldShowPrompt]
  );

  return {
    /** Whether the hook is still loading state from storage */
    isLoading,
    /** Check if a prompt should be shown (not yet dismissed) */
    shouldShowPrompt,
    /** Dismiss a prompt permanently */
    dismissPrompt,
    /** Get prompt content if it should be shown, or null if dismissed */
    getPrompt,
  };
}
