import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Database } from '@idynic/shared/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Debug: Log the Supabase URL at startup
console.log('[Supabase] URL:', supabaseUrl);
console.log('[Supabase] URL defined:', !!supabaseUrl);

// SecureStore has a 2048 byte limit. Supabase tokens exceed this.
// This adapter chunks large values across multiple keys.
const CHUNK_SIZE = 1800; // Leave margin for key overhead

// Track if we've had a session error that requires clearing
let sessionInvalid = false;

const LargeSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    // If session was marked invalid, return null to force re-login
    if (sessionInvalid && key.includes('auth-token')) {
      console.log('[Supabase] Session marked invalid, returning null for', key);
      return null;
    }

    try {
      // First try to get as single value (for small items or legacy)
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) {
        return value;
      }

      // Check if chunked
      const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
      if (!chunkCountStr) {
        return null;
      }

      const chunkCount = parseInt(chunkCountStr, 10);
      const chunks: string[] = [];
      for (let i = 0; i < chunkCount; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
        if (chunk === null) {
          // Corrupted chunked data
          return null;
        }
        chunks.push(chunk);
      }
      return chunks.join('');
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Clear any existing chunks first
      await LargeSecureStoreAdapter.removeItem(key);

      if (value.length <= CHUNK_SIZE) {
        // Small enough for single store
        await SecureStore.setItemAsync(key, value);
      } else {
        // Split into chunks
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          chunks.push(value.slice(i, i + CHUNK_SIZE));
        }

        // Store chunk count
        await SecureStore.setItemAsync(`${key}_chunks`, chunks.length.toString());

        // Store each chunk
        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
        }
      }
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      // Remove single value if exists
      await SecureStore.deleteItemAsync(key);

      // Remove chunks if exist
      const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunkCountStr) {
        const chunkCount = parseInt(chunkCountStr, 10);
        for (let i = 0; i < chunkCount; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
    } catch {
      // Ignore errors during cleanup
    }
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: LargeSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Function to mark session as invalid (called when refresh token errors occur)
export const markSessionInvalid = () => {
  console.log('[Supabase] Marking session as invalid');
  sessionInvalid = true;
};

// Function to reset the invalid flag (called after successful login)
export const resetSessionInvalid = () => {
  sessionInvalid = false;
};

// Listen for auth state changes and handle errors
supabase.auth.onAuthStateChange((event, session) => {
  // Reset invalid flag on successful sign in
  if (event === 'SIGNED_IN' && session) {
    sessionInvalid = false;
  }
});
