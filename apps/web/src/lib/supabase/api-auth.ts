import { createClient } from "./server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Get authenticated user from either cookies (web) or Bearer token (mobile).
 * Returns null if not authenticated.
 */
export async function getApiUser(request: Request): Promise<User | null> {
  // Try cookie-based auth first (web browser)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return user;
  }

  // Try Bearer token auth (mobile app)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // Create a client with the user's access token
    const tokenClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user: tokenUser },
    } = await tokenClient.auth.getUser();

    return tokenUser;
  }

  return null;
}
