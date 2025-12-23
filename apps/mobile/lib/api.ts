import { createApiClient } from '@idynic/shared/api';
import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL!;

export const api = createApiClient({
  baseUrl: apiUrl,
  getAuthToken: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  },
});
