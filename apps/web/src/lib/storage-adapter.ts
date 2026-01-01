import type { StorageAdapter } from "@idynic/shared";

/**
 * Web storage adapter wrapping localStorage for onboarding state persistence.
 *
 * Uses async interface for compatibility with the shared hook that also
 * supports React Native's AsyncStorage on mobile.
 */
export const webStorageAdapter: StorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.setItem(key, value);
  },
};
