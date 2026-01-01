import * as SecureStore from "expo-secure-store";
import type { StorageAdapter } from "@idynic/shared";

/**
 * Mobile storage adapter wrapping expo-secure-store for onboarding state persistence.
 *
 * Uses the StorageAdapter interface for compatibility with the shared
 * useOnboardingProgress hook.
 *
 * Note: SecureStore has a 2048 byte limit per key, but onboarding state
 * is small enough (~100 bytes) to fit comfortably.
 */
export const mobileStorageAdapter: StorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("SecureStore getItem error:", error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("SecureStore setItem error:", error);
    }
  },
};
